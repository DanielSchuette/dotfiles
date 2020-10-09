"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTransportKind = exports.getDocumentSelector = exports.getRevealOutputChannelOn = exports.getLanguageServerOptions = exports.documentSelectorToLanguageIds = exports.ServiceManager = exports.getStateName = void 0;
const tslib_1 = require("tslib");
const events_1 = require("events");
const fs_1 = tslib_1.__importDefault(require("fs"));
const net_1 = tslib_1.__importDefault(require("net"));
const vscode_languageserver_protocol_1 = require("vscode-languageserver-protocol");
const language_client_1 = require("./language-client");
const types_1 = require("./types");
const util_1 = require("./util");
const workspace_1 = tslib_1.__importDefault(require("./workspace"));
const logger = require('./util/logger')('services');
function getStateName(state) {
    switch (state) {
        case types_1.ServiceStat.Initial:
            return 'init';
        case types_1.ServiceStat.Running:
            return 'running';
        case types_1.ServiceStat.Starting:
            return 'starting';
        case types_1.ServiceStat.StartFailed:
            return 'startFailed';
        case types_1.ServiceStat.Stopping:
            return 'stopping';
        case types_1.ServiceStat.Stopped:
            return 'stopped';
        default:
            return 'unknown';
    }
}
exports.getStateName = getStateName;
class ServiceManager extends events_1.EventEmitter {
    constructor() {
        super(...arguments);
        this.registered = new Map();
        this.disposables = [];
    }
    init() {
        workspace_1.default.onDidOpenTextDocument(document => {
            this.start(document);
        }, null, this.disposables);
        workspace_1.default.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('languageserver')) {
                this.createCustomServices();
            }
        }, null, this.disposables);
        this.createCustomServices();
    }
    dispose() {
        this.removeAllListeners();
        util_1.disposeAll(this.disposables);
        for (let service of this.registered.values()) {
            service.dispose();
        }
    }
    regist(service) {
        let { id } = service;
        if (!id)
            logger.error('invalid service configuration. ', service.name);
        if (this.registered.get(id))
            return;
        this.registered.set(id, service);
        logger.info(`registered service "${id}"`);
        if (this.shouldStart(service)) {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            service.start();
        }
        if (service.state == types_1.ServiceStat.Running) {
            this.emit('ready', id);
        }
        service.onServiceReady(() => {
            logger.info(`service ${id} started`);
            this.emit('ready', id);
        }, null, this.disposables);
        return vscode_languageserver_protocol_1.Disposable.create(() => {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            service.stop();
            service.dispose();
            this.registered.delete(id);
        });
    }
    getService(id) {
        let service = this.registered.get(id);
        if (!service)
            service = this.registered.get(`languageserver.${id}`);
        return service;
    }
    shouldStart(service) {
        if (service.state != types_1.ServiceStat.Initial) {
            return false;
        }
        let selector = service.selector;
        for (let doc of workspace_1.default.documents) {
            if (workspace_1.default.match(selector, doc.textDocument)) {
                return true;
            }
        }
        return false;
    }
    start(document) {
        let services = this.getServices(document);
        for (let service of services) {
            if (service.state == types_1.ServiceStat.Initial) {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                service.start();
            }
        }
    }
    getServices(document) {
        let res = [];
        for (let service of this.registered.values()) {
            if (workspace_1.default.match(service.selector, document) > 0) {
                res.push(service);
            }
        }
        return res;
    }
    stop(id) {
        let service = this.registered.get(id);
        if (!service) {
            workspace_1.default.showMessage(`Service ${id} not found`, 'error');
            return;
        }
        return Promise.resolve(service.stop());
    }
    stopAll() {
        for (let service of this.registered.values()) {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            service.stop();
        }
    }
    async toggle(id) {
        let service = this.registered.get(id);
        if (!service) {
            workspace_1.default.showMessage(`Service ${id} not found`, 'error');
            return;
        }
        let { state } = service;
        try {
            if (state == types_1.ServiceStat.Running) {
                await Promise.resolve(service.stop());
            }
            else if (state == types_1.ServiceStat.Initial) {
                await service.start();
            }
            else if (state == types_1.ServiceStat.Stopped) {
                await service.restart();
            }
        }
        catch (e) {
            workspace_1.default.showMessage(`Service error: ${e.message}`, 'error');
        }
    }
    getServiceStats() {
        let res = [];
        for (let [id, service] of this.registered) {
            res.push({
                id,
                languageIds: documentSelectorToLanguageIds(service.selector),
                state: getStateName(service.state)
            });
        }
        return res;
    }
    createCustomServices() {
        let lspConfig = workspace_1.default.getConfiguration().get('languageserver', {});
        for (let key of Object.keys(lspConfig)) {
            let config = lspConfig[key];
            this.registLanguageClient(key, config);
        }
    }
    waitClient(id) {
        let service = this.getService(id);
        if (service && service.state == types_1.ServiceStat.Running)
            return Promise.resolve();
        if (service)
            return new Promise(resolve => {
                service.onServiceReady(() => {
                    resolve();
                });
            });
        return new Promise(resolve => {
            let listener = clientId => {
                if (clientId == id || clientId == `languageserver.${id}`) {
                    this.off('ready', listener);
                    resolve();
                }
            };
            this.on('ready', listener);
        });
    }
    async registNotification(id, method) {
        await this.waitClient(id);
        let service = this.getService(id);
        if (!service.client) {
            workspace_1.default.showMessage(`Not a language client: ${id}`, 'error');
            return;
        }
        let client = service.client;
        client.onNotification(method, async (result) => {
            await workspace_1.default.nvim.call('coc#do_notify', [id, method, result]);
        });
    }
    async sendNotification(id, method, params) {
        if (!method)
            throw new Error(`method required for ontification`);
        let service = this.getService(id);
        // wait for extension activate
        if (!service || !service.client)
            throw new Error(`Language server ${id} not found`);
        if (service.state == types_1.ServiceStat.Starting) {
            await service.client.onReady();
        }
        if (service.state != types_1.ServiceStat.Running) {
            throw new Error(`Language server ${id} not running`);
        }
        await Promise.resolve(service.client.sendNotification(method, params));
    }
    async sendRequest(id, method, params, token) {
        if (!method)
            throw new Error(`method required for sendRequest`);
        let service = this.getService(id);
        // wait for extension activate
        if (!service)
            await util_1.wait(100);
        service = this.getService(id);
        if (!service || !service.client) {
            throw new Error(`Language server ${id} not found`);
        }
        if (service.state == types_1.ServiceStat.Starting) {
            await service.client.onReady();
        }
        if (service.state != types_1.ServiceStat.Running) {
            throw new Error(`Language server ${id} not running`);
        }
        return await Promise.resolve(service.client.sendRequest(method, params, token));
    }
    registLanguageClient(name, config) {
        let id = typeof name === 'string' ? `languageserver.${name}` : name.id;
        let disposables = [];
        let onDidServiceReady = new vscode_languageserver_protocol_1.Emitter();
        let client = typeof name === 'string' ? null : name;
        if (this.registered.has(id))
            return;
        let created = false;
        let service = {
            id,
            client,
            name: typeof name === 'string' ? name : name.name,
            selector: typeof name === 'string' ? getDocumentSelector(config.filetypes, config.additionalSchemes) : name.clientOptions.documentSelector,
            state: types_1.ServiceStat.Initial,
            onServiceReady: onDidServiceReady.event,
            start: () => {
                if (service.state == types_1.ServiceStat.Starting || service.state == types_1.ServiceStat.Running) {
                    return;
                }
                if (client && !client.needsStart()) {
                    return;
                }
                if (created && client) {
                    client.restart();
                    return Promise.resolve();
                }
                if (!created) {
                    if (typeof name == 'string' && !client) {
                        let config = workspace_1.default.getConfiguration().get('languageserver', {})[name];
                        if (!config || config.enable === false)
                            return;
                        let opts = getLanguageServerOptions(id, name, config);
                        if (!opts)
                            return;
                        client = new language_client_1.LanguageClient(id, name, opts[1], opts[0]);
                        service.selector = opts[0].documentSelector;
                        service.client = client;
                    }
                    client.onDidChangeState(changeEvent => {
                        let { oldState, newState } = changeEvent;
                        if (newState == language_client_1.State.Starting) {
                            service.state = types_1.ServiceStat.Starting;
                        }
                        else if (newState == language_client_1.State.Running) {
                            service.state = types_1.ServiceStat.Running;
                        }
                        else if (newState == language_client_1.State.Stopped) {
                            service.state = types_1.ServiceStat.Stopped;
                        }
                        let oldStr = stateString(oldState);
                        let newStr = stateString(newState);
                        logger.info(`${client.name} state change: ${oldStr} => ${newStr}`);
                    }, null, disposables);
                    created = true;
                }
                service.state = types_1.ServiceStat.Starting;
                logger.debug(`starting service: ${id}`);
                let disposable = client.start();
                disposables.push(disposable);
                return new Promise(resolve => {
                    client.onReady().then(() => {
                        onDidServiceReady.fire(void 0);
                        resolve();
                    }, e => {
                        workspace_1.default.showMessage(`Server ${id} failed to start: ${e}`, 'error');
                        logger.error(`Server ${id} failed to start:`, e);
                        service.state = types_1.ServiceStat.StartFailed;
                        resolve();
                    });
                });
            },
            dispose: async () => {
                onDidServiceReady.dispose();
                util_1.disposeAll(disposables);
            },
            stop: async () => {
                if (!client || !client.needsStop())
                    return;
                await Promise.resolve(client.stop());
            },
            restart: async () => {
                if (client) {
                    service.state = types_1.ServiceStat.Starting;
                    client.restart();
                }
                else {
                    await service.start();
                }
            },
        };
        return this.regist(service);
    }
}
exports.ServiceManager = ServiceManager;
function documentSelectorToLanguageIds(documentSelector) {
    let res = documentSelector.map(filter => {
        if (typeof filter == 'string') {
            return filter;
        }
        return filter.language;
    });
    res = res.filter(s => typeof s == 'string');
    return Array.from(new Set(res));
}
exports.documentSelectorToLanguageIds = documentSelectorToLanguageIds;
// convert config to options
function getLanguageServerOptions(id, name, config) {
    let { command, module, port, args, filetypes } = config;
    args = args || [];
    if (!filetypes) {
        workspace_1.default.showMessage(`Wrong configuration of LS "${name}", filetypes not found`, 'error');
        return null;
    }
    if (!command && !module && !port) {
        workspace_1.default.showMessage(`Wrong configuration of LS "${name}", no command or module specified.`, 'error');
        return null;
    }
    let serverOptions;
    if (module) {
        module = workspace_1.default.expand(module);
        if (!fs_1.default.existsSync(module)) {
            workspace_1.default.showMessage(`Module file "${module}" not found for LS "${name}"`, 'error');
            return null;
        }
        serverOptions = {
            module,
            runtime: config.runtime || process.execPath,
            args,
            transport: getTransportKind(config),
            options: getForkOptions(config)
        };
    }
    else if (command) {
        serverOptions = {
            command,
            args,
            options: getSpawnOptions(config)
        };
    }
    else if (port) {
        serverOptions = () => new Promise((resolve, reject) => {
            let client = new net_1.default.Socket();
            let host = config.host || '127.0.0.1';
            logger.info(`languageserver "${id}" connecting to ${host}:${port}`);
            client.connect(port, host, () => {
                resolve({
                    reader: client,
                    writer: client
                });
            });
            client.on('error', e => {
                reject(new Error(`Connection error for ${id}: ${e.message}`));
            });
        });
    }
    let disableWorkspaceFolders = !!config.disableWorkspaceFolders;
    let disableSnippetCompletion = !!config.disableSnippetCompletion;
    let ignoredRootPaths = config.ignoredRootPaths || [];
    let clientOptions = {
        ignoredRootPaths: ignoredRootPaths.map(s => workspace_1.default.expand(s)),
        disableWorkspaceFolders,
        disableSnippetCompletion,
        disableDynamicRegister: !!config.disableDynamicRegister,
        disableCompletion: !!config.disableCompletion,
        disableDiagnostics: !!config.disableDiagnostics,
        formatterPriority: config.formatterPriority || 0,
        documentSelector: getDocumentSelector(config.filetypes, config.additionalSchemes),
        revealOutputChannelOn: getRevealOutputChannelOn(config.revealOutputChannelOn),
        synchronize: {
            configurationSection: `${id}.settings`
        },
        diagnosticCollectionName: name,
        outputChannelName: id,
        stdioEncoding: config.stdioEncoding || 'utf8',
        progressOnInitialization: config.progressOnInitialization !== false,
        initializationOptions: config.initializationOptions || {}
    };
    return [clientOptions, serverOptions];
}
exports.getLanguageServerOptions = getLanguageServerOptions;
function getRevealOutputChannelOn(revealOn) {
    switch (revealOn) {
        case 'info':
            return language_client_1.RevealOutputChannelOn.Info;
        case 'warn':
            return language_client_1.RevealOutputChannelOn.Warn;
        case 'error':
            return language_client_1.RevealOutputChannelOn.Error;
        case 'never':
            return language_client_1.RevealOutputChannelOn.Never;
        default:
            return language_client_1.RevealOutputChannelOn.Never;
    }
}
exports.getRevealOutputChannelOn = getRevealOutputChannelOn;
function getDocumentSelector(filetypes, additionalSchemes) {
    let documentSelector = [];
    let schemes = ['file', 'untitled'].concat(additionalSchemes || []);
    if (!filetypes)
        return schemes.map(s => ({ scheme: s }));
    filetypes.forEach(filetype => {
        documentSelector.push(...schemes.map(scheme => ({ language: filetype, scheme })));
    });
    return documentSelector;
}
exports.getDocumentSelector = getDocumentSelector;
function getTransportKind(config) {
    let { transport, transportPort } = config;
    if (!transport || transport == 'ipc')
        return language_client_1.TransportKind.ipc;
    if (transport == 'stdio')
        return language_client_1.TransportKind.stdio;
    if (transport == 'pipe')
        return language_client_1.TransportKind.pipe;
    return { kind: language_client_1.TransportKind.socket, port: transportPort };
}
exports.getTransportKind = getTransportKind;
function getForkOptions(config) {
    return {
        cwd: config.cwd,
        execArgv: config.execArgv || [],
        env: config.env || undefined
    };
}
function getSpawnOptions(config) {
    return {
        cwd: config.cwd,
        detached: !!config.detached,
        shell: !!config.shell,
        env: config.env || undefined
    };
}
function stateString(state) {
    switch (state) {
        case language_client_1.State.Running:
            return 'running';
        case language_client_1.State.Starting:
            return 'starting';
        case language_client_1.State.Stopped:
            return 'stopped';
        default:
            return 'unknown';
    }
}
exports.default = new ServiceManager();
//# sourceMappingURL=services.js.map