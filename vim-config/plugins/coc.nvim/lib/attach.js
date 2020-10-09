"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const neovim_1 = require("@chemzqm/neovim");
const log4js_1 = tslib_1.__importDefault(require("log4js"));
const events_1 = tslib_1.__importDefault(require("./events"));
const plugin_1 = tslib_1.__importDefault(require("./plugin"));
const semver_1 = tslib_1.__importDefault(require("semver"));
const is_1 = require("./util/is");
require("./util/extensions");
const vscode_uri_1 = require("vscode-uri");
const logger = require('./util/logger')('attach');
const isTest = global.hasOwnProperty('__TEST__');
exports.default = (opts, requestApi = true) => {
    const nvim = neovim_1.attach(opts, log4js_1.default.getLogger('node-client'), requestApi);
    const timeout = process.env.COC_CHANNEL_TIMEOUT ? parseInt(process.env.COC_CHANNEL_TIMEOUT, 10) : 30;
    if (!global.hasOwnProperty('__TEST__')) {
        nvim.call('coc#util#path_replace_patterns').then(prefixes => {
            if (is_1.objectLiteral(prefixes)) {
                const old_uri = vscode_uri_1.URI.file;
                vscode_uri_1.URI.file = (path) => {
                    path = path.replace(/\\/g, '/');
                    Object.keys(prefixes).forEach(k => path = path.replace(new RegExp('^' + k), prefixes[k]));
                    return old_uri(path);
                };
            }
        }).logError();
    }
    nvim.setVar('coc_process_pid', process.pid, true);
    const plugin = new plugin_1.default(nvim);
    let clientReady = false;
    let initialized = false;
    nvim.on('notification', async (method, args) => {
        switch (method) {
            case 'VimEnter': {
                if (!initialized && clientReady) {
                    initialized = true;
                    await plugin.init();
                }
                break;
            }
            case 'TaskExit':
            case 'TaskStderr':
            case 'TaskStdout':
            case 'GlobalChange':
            case 'PromptInsert':
            case 'InputChar':
            case 'MenuInput':
            case 'OptionSet':
                await events_1.default.fire(method, args);
                break;
            case 'CocAutocmd':
                await events_1.default.fire(args[0], args.slice(1));
                break;
            default: {
                let exists = plugin.hasAction(method);
                if (!exists) {
                    if (global.hasOwnProperty('__TEST__'))
                        return;
                    console.error(`action "${method}" not registered`);
                    return;
                }
                try {
                    if (!plugin.isReady) {
                        logger.warn(`Plugin not ready when received "${method}"`, args);
                    }
                    await plugin.ready;
                    await plugin.cocAction(method, ...args);
                }
                catch (e) {
                    console.error(`Error on notification "${method}": ${e.message || e.toString()}`);
                    logger.error(`Notification error:`, method, args, e);
                }
            }
        }
    });
    nvim.on('request', async (method, args, resp) => {
        let timer = setTimeout(() => {
            logger.error('Request cost more than 3s', method, args);
        }, timeout * 3000);
        try {
            if (method == 'CocAutocmd') {
                await events_1.default.fire(args[0], args.slice(1));
                resp.send();
            }
            else {
                if (!plugin.hasAction(method)) {
                    throw new Error(`action "${method}" not registered`);
                }
                if (!plugin.isReady) {
                    logger.warn(`Plugin not ready when received "${method}"`, args);
                }
                let res = await plugin.cocAction(method, ...args);
                resp.send(res);
            }
            clearTimeout(timer);
        }
        catch (e) {
            clearTimeout(timer);
            resp.send(e.message || e.toString(), true);
            logger.error(`Request error:`, method, args, e);
        }
    });
    nvim.channelId.then(async (channelId) => {
        clientReady = true;
        // Used for test client on vim side
        if (isTest)
            nvim.command(`let g:coc_node_channel_id = ${channelId}`, true);
        let json = require('../package.json');
        let { major, minor, patch } = semver_1.default.parse(json.version);
        nvim.setClientInfo('coc', { major, minor, patch }, 'remote', {}, {});
        let entered = await nvim.getVvar('vim_did_enter');
        if (entered && !initialized) {
            initialized = true;
            await plugin.init();
        }
    }).catch(e => {
        console.error(`Channel create error: ${e.message}`);
    });
    return plugin;
};
//# sourceMappingURL=attach.js.map