"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Extensions = void 0;
const tslib_1 = require("tslib");
const debounce_1 = require("debounce");
const fs_1 = tslib_1.__importDefault(require("fs"));
const isuri_1 = tslib_1.__importDefault(require("isuri"));
const path_1 = tslib_1.__importDefault(require("path"));
const rimraf_1 = tslib_1.__importDefault(require("rimraf"));
const semver_1 = tslib_1.__importDefault(require("semver"));
const util_1 = require("util");
const vscode_languageserver_protocol_1 = require("vscode-languageserver-protocol");
const vscode_uri_1 = require("vscode-uri");
const which_1 = tslib_1.__importDefault(require("which"));
const commands_1 = tslib_1.__importDefault(require("./commands"));
const events_1 = tslib_1.__importDefault(require("./events"));
const db_1 = tslib_1.__importDefault(require("./model/db"));
const floatFactory_1 = tslib_1.__importDefault(require("./model/floatFactory"));
const installBuffer_1 = tslib_1.__importDefault(require("./model/installBuffer"));
const installer_1 = require("./model/installer");
const memos_1 = tslib_1.__importDefault(require("./model/memos"));
const types_1 = require("./types");
const util_2 = require("./util");
const array_1 = require("./util/array");
require("./util/extensions");
const factory_1 = require("./util/factory");
const fs_2 = require("./util/fs");
const is_1 = require("./util/is");
const watchman_1 = tslib_1.__importDefault(require("./watchman"));
const workspace_1 = tslib_1.__importDefault(require("./workspace"));
const mkdirp_1 = tslib_1.__importDefault(require("mkdirp"));
const createLogger = require('./util/logger');
const logger = createLogger('extensions');
function loadJson(file) {
    try {
        let content = fs_1.default.readFileSync(file, 'utf8');
        return JSON.parse(content);
    }
    catch (e) {
        return null;
    }
}
// global local file native
class Extensions {
    constructor() {
        this.extensions = new Map();
        this.disabled = new Set();
        this._onDidLoadExtension = new vscode_languageserver_protocol_1.Emitter();
        this._onDidActiveExtension = new vscode_languageserver_protocol_1.Emitter();
        this._onDidUnloadExtension = new vscode_languageserver_protocol_1.Emitter();
        this._additionalSchemes = {};
        this.activated = false;
        this.disposables = [];
        this.ready = true;
        this.onDidLoadExtension = this._onDidLoadExtension.event;
        this.onDidActiveExtension = this._onDidActiveExtension.event;
        this.onDidUnloadExtension = this._onDidUnloadExtension.event;
        let folder = global.hasOwnProperty('__TEST__') ? path_1.default.join(__dirname, '__tests__') : process.env.COC_DATA_HOME;
        let root = this.root = path_1.default.join(folder, 'extensions');
        if (!fs_1.default.existsSync(root)) {
            mkdirp_1.default.sync(root);
        }
        let jsonFile = path_1.default.join(root, 'package.json');
        if (!fs_1.default.existsSync(jsonFile)) {
            fs_1.default.writeFileSync(jsonFile, '{"dependencies":{}}', 'utf8');
        }
        let filepath = path_1.default.join(root, 'db.json');
        this.db = new db_1.default(filepath);
    }
    async init() {
        let data = loadJson(this.db.filepath) || {};
        let keys = Object.keys(data.extension || {});
        for (let key of keys) {
            if (data.extension[key].disabled == true) {
                this.disabled.add(key);
            }
        }
        if (process.env.COC_NO_PLUGINS)
            return;
        let stats = await this.globalExtensionStats();
        let localStats = await this.localExtensionStats(stats.map(o => o.id));
        stats = stats.concat(localStats);
        this.memos = new memos_1.default(path_1.default.resolve(this.root, '../memos.json'));
        stats.map(stat => {
            let extensionType = stat.isLocal ? types_1.ExtensionType.Local : types_1.ExtensionType.Global;
            try {
                this.createExtension(stat.root, stat.packageJSON, extensionType);
            }
            catch (e) {
                logger.error(`Error on create ${stat.root}:`, e);
            }
        });
        await this.loadFileExtensions();
        commands_1.default.register({
            id: 'extensions.forceUpdateAll',
            execute: async () => {
                let arr = await this.cleanExtensions();
                logger.info(`Force update extensions: ${arr}`);
                await this.installExtensions(arr);
            }
        }, false, 'remove all global extensions and install them');
        workspace_1.default.onDidRuntimePathChange(async (paths) => {
            for (let p of paths) {
                if (p && this.checkDirectory(p) === true) {
                    await this.loadExtension(p);
                }
            }
        }, null, this.disposables);
    }
    async activateExtensions() {
        this.activated = true;
        for (let item of this.extensions.values()) {
            let { id, packageJSON } = item.extension;
            await this.setupActiveEvents(id, packageJSON);
        }
        // make sure workspace.env exists
        let floatFactory = new floatFactory_1.default(workspace_1.default.nvim, workspace_1.default.env);
        events_1.default.on('CursorMoved', debounce_1.debounce(async (bufnr) => {
            if (this.installBuffer && bufnr == this.installBuffer.bufnr) {
                let lnum = await workspace_1.default.nvim.call('line', ['.']);
                let msgs = this.installBuffer.getMessages(lnum - 1);
                let docs = msgs.length ? [{ content: msgs.join('\n'), filetype: 'txt' }] : [];
                await floatFactory.create(docs, false);
            }
        }, 500));
        if (global.hasOwnProperty('__TEST__'))
            return;
        // check extensions need watch & install
        this.checkExtensions().logError();
        let config = workspace_1.default.getConfiguration('coc.preferences');
        let interval = config.get('extensionUpdateCheck', 'never');
        if (interval != 'never') {
            let now = new Date();
            let day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (interval == 'daily' ? 0 : 7));
            let ts = this.db.fetch('lastUpdate');
            if (ts && Number(ts) > day.getTime())
                return;
            this.updateExtensions(false, true).logError();
        }
    }
    async updateExtensions(sync, silent = false) {
        if (!this.npm)
            return;
        let lockedList = await this.getLockedList();
        let stats = await this.globalExtensionStats();
        stats = stats.filter(o => ![...lockedList, ...this.disabled].includes(o.id));
        this.db.push('lastUpdate', Date.now());
        let installBuffer = this.installBuffer = new installBuffer_1.default(true, sync, silent);
        installBuffer.setExtensions(stats.map(o => o.id));
        await installBuffer.show(workspace_1.default.nvim);
        let createInstaller = installer_1.createInstallerFactory(this.npm, this.modulesFolder);
        let fn = (stat) => {
            let { id } = stat;
            installBuffer.startProgress([id]);
            let url = stat.exotic ? stat.uri : null;
            return createInstaller(id, msg => installBuffer.addMessage(id, msg)).update(url).then(directory => {
                installBuffer.finishProgress(id, true);
                if (directory) {
                    this.loadExtension(directory).logError();
                }
            }, err => {
                installBuffer.addMessage(id, err.message);
                installBuffer.finishProgress(id, false);
            });
        };
        await util_2.concurrent(stats, fn);
    }
    async checkExtensions() {
        let { globalExtensions, watchExtensions } = workspace_1.default.env;
        if (globalExtensions && globalExtensions.length) {
            let names = this.filterGlobalExtensions(globalExtensions);
            this.installExtensions(names).logError();
        }
        // watch for changes
        if (watchExtensions && watchExtensions.length) {
            let watchmanPath = workspace_1.default.getWatchmanPath();
            if (!watchmanPath)
                return;
            for (let name of watchExtensions) {
                let item = this.extensions.get(name);
                if (item && item.directory) {
                    let directory = await util_1.promisify(fs_1.default.realpath)(item.directory);
                    let client = await watchman_1.default.createClient(watchmanPath, directory);
                    if (client) {
                        this.disposables.push(client);
                        client.subscribe('**/*.js', async () => {
                            await this.reloadExtension(name);
                            workspace_1.default.showMessage(`reloaded ${name}`);
                        }).then(disposable => {
                            this.disposables.push(disposable);
                        }, e => {
                            logger.error(e);
                        });
                    }
                }
            }
        }
    }
    /**
     * Install extensions, can be called without initialize.
     */
    async installExtensions(list = []) {
        let { npm } = this;
        if (!npm || !list.length)
            return;
        list = array_1.distinct(list);
        let installBuffer = this.installBuffer = new installBuffer_1.default();
        installBuffer.setExtensions(list);
        await installBuffer.show(workspace_1.default.nvim);
        let createInstaller = installer_1.createInstallerFactory(this.npm, this.modulesFolder);
        let fn = (key) => {
            installBuffer.startProgress([key]);
            return createInstaller(key, msg => installBuffer.addMessage(key, msg)).install().then(name => {
                installBuffer.finishProgress(key, true);
                let directory = path_1.default.join(this.modulesFolder, name);
                this.loadExtension(directory).logError();
            }, err => {
                installBuffer.addMessage(key, err.message);
                installBuffer.finishProgress(key, false);
                logger.error(`Error on install ${key}`, err);
            });
        };
        await util_2.concurrent(list, fn);
    }
    /**
     * Get list of extensions in package.json that not installed
     */
    getMissingExtensions() {
        let json = this.loadJson() || { dependencies: {} };
        let ids = [];
        for (let key of Object.keys(json.dependencies)) {
            let folder = path_1.default.join(this.modulesFolder, key);
            if (!fs_1.default.existsSync(folder)) {
                let val = json.dependencies[key];
                if (val.startsWith('http')) {
                    ids.push(val);
                }
                else {
                    ids.push(key);
                }
            }
        }
        return ids;
    }
    get npm() {
        let npm = workspace_1.default.getConfiguration('npm').get('binPath', 'npm');
        npm = workspace_1.default.expand(npm);
        for (let exe of [npm, 'yarnpkg', 'yarn', 'npm']) {
            try {
                let res = which_1.default.sync(exe);
                return res;
            }
            catch (e) {
                continue;
            }
        }
        workspace_1.default.showMessage(`Can't find npm or yarn in your $PATH`, 'error');
        return null;
    }
    /**
     * Get all loaded extensions.
     */
    get all() {
        return Array.from(this.extensions.values()).map(o => o.extension).filter(o => !this.isDisabled(o.id));
    }
    getExtension(id) {
        return this.extensions.get(id);
    }
    getExtensionState(id) {
        let disabled = this.isDisabled(id);
        if (disabled)
            return 'disabled';
        let item = this.extensions.get(id);
        if (!item)
            return 'unknown';
        let { extension } = item;
        return extension.isActive ? 'activated' : 'loaded';
    }
    async getExtensionStates() {
        let globalStats = await this.globalExtensionStats();
        let localStats = await this.localExtensionStats([]);
        return globalStats.concat(localStats);
    }
    async getLockedList() {
        let obj = await this.db.fetch('extension');
        obj = obj || {};
        return Object.keys(obj).filter(id => obj[id].locked === true);
    }
    async toggleLock(id) {
        let key = `extension.${id}.locked`;
        let locked = await this.db.fetch(key);
        if (locked) {
            this.db.delete(key);
        }
        else {
            this.db.push(key, true);
        }
    }
    async toggleExtension(id) {
        let state = this.getExtensionState(id);
        if (state == null)
            return;
        if (state == 'activated') {
            await this.deactivate(id);
        }
        let key = `extension.${id}.disabled`;
        this.db.push(key, state == 'disabled' ? false : true);
        if (state != 'disabled') {
            this.disabled.add(id);
            await this.unloadExtension(id);
        }
        else {
            this.disabled.delete(id);
            let folder = path_1.default.join(this.modulesFolder, id);
            if (fs_1.default.existsSync(folder)) {
                await this.loadExtension(folder);
            }
        }
        await util_2.wait(200);
    }
    async reloadExtension(id) {
        let item = this.extensions.get(id);
        if (!item) {
            workspace_1.default.showMessage(`Extension ${id} not registered`, 'error');
            return;
        }
        if (item.type == types_1.ExtensionType.Internal) {
            workspace_1.default.showMessage(`Can't reload internal extension "${item.id}"`, 'warning');
            return;
        }
        if (item.type == types_1.ExtensionType.SingleFile) {
            await this.loadExtensionFile(item.filepath);
        }
        else if (item.directory) {
            await this.loadExtension(item.directory);
        }
        else {
            workspace_1.default.showMessage(`Can't reload extension ${item.id}`, 'warning');
        }
    }
    /**
     * Unload & remove all global extensions, return removed extensions.
     */
    async cleanExtensions() {
        let dir = this.modulesFolder;
        if (!fs_1.default.existsSync(dir))
            return [];
        let ids = this.globalExtensions;
        let res = [];
        for (let id of ids) {
            let directory = path_1.default.join(dir, id);
            let stat = await util_1.promisify(fs_1.default.lstat)(directory);
            if (!stat || (stat && stat.isSymbolicLink()))
                continue;
            await this.unloadExtension(id);
            await util_1.promisify(rimraf_1.default)(directory, { glob: false });
            res.push(id);
        }
        return res;
    }
    async uninstallExtension(ids) {
        try {
            if (!ids.length)
                return;
            let [globals, filtered] = array_1.splitArray(ids, id => this.globalExtensions.includes(id));
            if (filtered.length) {
                workspace_1.default.showMessage(`Extensions ${filtered} not global extensions, can't uninstall!`, 'warning');
            }
            let json = this.loadJson() || { dependencies: {} };
            for (let id of globals) {
                await this.unloadExtension(id);
                delete json.dependencies[id];
                // remove directory
                let folder = path_1.default.join(this.modulesFolder, id);
                if (fs_1.default.existsSync(folder)) {
                    await util_1.promisify(rimraf_1.default)(folder, { glob: false });
                }
            }
            // update package.json
            const sortedObj = { dependencies: {} };
            Object.keys(json.dependencies).sort().forEach(k => {
                sortedObj.dependencies[k] = json.dependencies[k];
            });
            let jsonFile = path_1.default.join(this.root, 'package.json');
            fs_1.default.writeFileSync(jsonFile, JSON.stringify(sortedObj, null, 2), { encoding: 'utf8' });
            workspace_1.default.showMessage(`Removed: ${globals.join(' ')}`);
        }
        catch (e) {
            workspace_1.default.showMessage(`Uninstall failed: ${e.message}`, 'error');
        }
    }
    isDisabled(id) {
        return this.disabled.has(id);
    }
    has(id) {
        return this.extensions.has(id);
    }
    isActivated(id) {
        let item = this.extensions.get(id);
        if (item && item.extension.isActive) {
            return true;
        }
        return false;
    }
    /**
     * Load extension from folder, folder should contains coc extension.
     */
    async loadExtension(folder) {
        try {
            let parentFolder = path_1.default.dirname(folder);
            let isLocal = path_1.default.normalize(parentFolder) != path_1.default.normalize(this.modulesFolder);
            let jsonFile = path_1.default.join(folder, 'package.json');
            let packageJSON = JSON.parse(fs_1.default.readFileSync(jsonFile, 'utf8'));
            let { name } = packageJSON;
            if (this.isDisabled(name))
                return false;
            // unload if loaded
            await this.unloadExtension(name);
            this.createExtension(folder, Object.freeze(packageJSON), isLocal ? types_1.ExtensionType.Local : types_1.ExtensionType.Global);
            return true;
        }
        catch (e) {
            workspace_1.default.showMessage(`Error on load extension from "${folder}": ${e.message}`, 'error');
            logger.error(`Error on load extension from ${folder}`, e);
            return false;
        }
    }
    async loadFileExtensions() {
        if (!process.env.COC_VIMCONFIG)
            return;
        let folder = path_1.default.join(process.env.COC_VIMCONFIG, 'coc-extensions');
        if (!fs_1.default.existsSync(folder))
            return;
        let files = await fs_2.readdirAsync(folder);
        files = files.filter(f => f.endsWith('.js'));
        for (let file of files) {
            await this.loadExtensionFile(path_1.default.join(folder, file));
        }
        let watchmanPath = workspace_1.default.getWatchmanPath();
        if (!watchmanPath)
            return;
        let client = await watchman_1.default.createClient(watchmanPath, folder);
        if (!client)
            return;
        this.disposables.push(client);
        client.subscribe('*.js', async ({ root, files }) => {
            files = files.filter(f => f.type == 'f');
            for (let file of files) {
                let id = `single-` + path_1.default.basename(file.name, 'js');
                if (file.exists) {
                    let filepath = path_1.default.join(root, file.name);
                    await this.loadExtensionFile(filepath);
                }
                else {
                    await this.unloadExtension(id);
                }
            }
        }).then(disposable => {
            this.disposables.push(disposable);
        }, e => {
            logger.error(e);
        });
    }
    /**
     * Load single javascript file as extension.
     */
    async loadExtensionFile(filepath) {
        let filename = path_1.default.basename(filepath);
        let name = 'single-' + path_1.default.basename(filepath, '.js');
        if (this.isDisabled(name))
            return;
        let root = path_1.default.dirname(filepath);
        let packageJSON = {
            name, main: filename, engines: { coc: '^0.0.79' }
        };
        await this.unloadExtension(name);
        this.createExtension(root, packageJSON, types_1.ExtensionType.SingleFile);
    }
    /**
     * Activate extension, throw error if disabled or not exists
     * Returns true if extension successfully activated.
     */
    async activate(id) {
        if (this.isDisabled(id)) {
            throw new Error(`Extension ${id} is disabled!`);
        }
        let item = this.extensions.get(id);
        if (!item) {
            throw new Error(`Extension ${id} not registered!`);
        }
        let { extension } = item;
        if (extension.isActive)
            return true;
        await Promise.resolve(extension.activate());
        if (extension.isActive) {
            this._onDidActiveExtension.fire(extension);
            return true;
        }
        return false;
    }
    async deactivate(id) {
        let item = this.extensions.get(id);
        if (!item)
            return false;
        await Promise.resolve(item.deactivate());
        return true;
    }
    async call(id, method, args) {
        let item = this.extensions.get(id);
        if (!item)
            throw new Error(`extension ${id} not registered`);
        let { extension } = item;
        if (!extension.isActive) {
            await this.activate(id);
        }
        let { exports } = extension;
        if (!exports || !exports.hasOwnProperty(method)) {
            throw new Error(`method ${method} not found on extension ${id}`);
        }
        return await Promise.resolve(exports[method].apply(null, args));
    }
    getExtensionApi(id) {
        let item = this.extensions.get(id);
        if (!item)
            return null;
        let { extension } = item;
        return extension.isActive ? extension.exports : null;
    }
    registerExtension(extension, deactivate) {
        let { id, packageJSON } = extension;
        this.extensions.set(id, { id, type: types_1.ExtensionType.Internal, extension, deactivate, isLocal: true });
        let { contributes } = packageJSON;
        if (contributes) {
            let { configuration } = contributes;
            if (configuration && configuration.properties) {
                let { properties } = configuration;
                let props = {};
                for (let key of Object.keys(properties)) {
                    let val = properties[key].default;
                    if (val != null)
                        props[key] = val;
                }
                workspace_1.default.configurations.extendsDefaults(props);
            }
        }
        this._onDidLoadExtension.fire(extension);
        this.setupActiveEvents(id, packageJSON).logError();
    }
    get globalExtensions() {
        let json = this.loadJson();
        if (!json || !json.dependencies)
            return [];
        return Object.keys(json.dependencies);
    }
    async globalExtensionStats() {
        let json = this.loadJson();
        if (!json || !json.dependencies)
            return [];
        let { modulesFolder } = this;
        let res = await Promise.all(Object.keys(json.dependencies).map(key => new Promise(async (resolve) => {
            try {
                let val = json.dependencies[key];
                let root = path_1.default.join(modulesFolder, key);
                let res = this.checkDirectory(root);
                if (res instanceof Error) {
                    workspace_1.default.showMessage(`Unable to load global extension at ${root}: ${res.message}`, 'error');
                    logger.error(`Error on load ${root}`, res);
                    return resolve(null);
                }
                let content = await fs_2.readFile(path_1.default.join(root, 'package.json'), 'utf8');
                root = await fs_2.realpathAsync(root);
                let obj = JSON.parse(content);
                let version = obj ? obj.version || '' : '';
                let description = obj ? obj.description || '' : '';
                let uri = isuri_1.default.isValid(val) ? val : '';
                resolve({
                    id: key,
                    isLocal: false,
                    version,
                    description,
                    exotic: /^https?:/.test(val),
                    uri: uri.replace(/\.git(#master)?$/, ''),
                    root,
                    state: this.getExtensionState(key),
                    packageJSON: Object.freeze(obj)
                });
            }
            catch (e) {
                logger.error(e);
                resolve(null);
            }
        })));
        return res.filter(info => info != null);
    }
    async localExtensionStats(excludes) {
        let runtimepath = await workspace_1.default.nvim.eval('&runtimepath');
        let paths = runtimepath.split(',');
        let res = await Promise.all(paths.map(root => new Promise(async (resolve) => {
            try {
                let res = this.checkDirectory(root);
                if (res !== true)
                    return resolve(null);
                let jsonFile = path_1.default.join(root, 'package.json');
                let content = await fs_2.readFile(jsonFile, 'utf8');
                let obj = JSON.parse(content);
                let exist = this.extensions.get(obj.name);
                if (exist && !exist.isLocal) {
                    logger.info(`Extension "${obj.name}" in runtimepath already loaded.`);
                    return resolve(null);
                }
                if (excludes.includes(obj.name)) {
                    logger.info(`Skipped load vim plugin from "${root}", "${obj.name}" already global extension.`);
                    return resolve(null);
                }
                let version = obj ? obj.version || '' : '';
                let description = obj ? obj.description || '' : '';
                resolve({
                    id: obj.name,
                    isLocal: true,
                    version,
                    description,
                    exotic: false,
                    root,
                    state: this.getExtensionState(obj.name),
                    packageJSON: Object.freeze(obj)
                });
            }
            catch (e) {
                logger.error(e);
                resolve(null);
            }
        })));
        return res.filter(info => info != null);
    }
    loadJson() {
        let { root } = this;
        let jsonFile = path_1.default.join(root, 'package.json');
        if (!fs_1.default.existsSync(jsonFile))
            return null;
        return loadJson(jsonFile);
    }
    get schemes() {
        return this._additionalSchemes;
    }
    addSchemeProperty(key, def) {
        this._additionalSchemes[key] = def;
        workspace_1.default.configurations.extendsDefaults({ [key]: def.default });
    }
    async setupActiveEvents(id, packageJSON) {
        let { activationEvents } = packageJSON;
        if (!this.canActivate(id))
            return;
        if (!activationEvents || Array.isArray(activationEvents) && activationEvents.includes('*')) {
            await this.activate(id).catch(e => {
                workspace_1.default.showMessage(`Error on activate extension ${id}: ${e.message}`);
                logger.error(`Error on activate extension ${id}`, e);
            });
            return;
        }
        let disposables = [];
        let active = () => {
            util_2.disposeAll(disposables);
            return new Promise(resolve => {
                if (!this.canActivate(id))
                    return resolve();
                let timer = setTimeout(() => {
                    logger.warn(`Extension ${id} activate cost more than 1s`);
                    resolve();
                }, 1000);
                this.activate(id).then(() => {
                    clearTimeout(timer);
                    resolve();
                }, e => {
                    clearTimeout(timer);
                    workspace_1.default.showMessage(`Error on activate extension ${id}: ${e.message}`);
                    logger.error(`Error on activate extension ${id}`, e);
                    resolve();
                });
            });
        };
        for (let eventName of activationEvents) {
            let parts = eventName.split(':');
            let ev = parts[0];
            if (ev == 'onLanguage') {
                if (workspace_1.default.filetypes.has(parts[1])) {
                    await active();
                    return;
                }
                workspace_1.default.onDidOpenTextDocument(document => {
                    if (document.languageId == parts[1]) {
                        active().logError();
                    }
                }, null, disposables);
            }
            else if (ev == 'onCommand') {
                events_1.default.on('Command', command => {
                    if (command == parts[1]) {
                        active().logError();
                        // wait for service ready
                        return new Promise(resolve => {
                            setTimeout(resolve, 500);
                        });
                    }
                }, null, disposables);
            }
            else if (ev == 'workspaceContains') {
                let check = async () => {
                    let folders = workspace_1.default.workspaceFolders.map(o => vscode_uri_1.URI.parse(o.uri).fsPath);
                    for (let folder of folders) {
                        if (fs_2.inDirectory(folder, parts[1].split(/\s+/))) {
                            await active();
                            return true;
                        }
                    }
                };
                let res = await check();
                if (res)
                    return;
                workspace_1.default.onDidChangeWorkspaceFolders(check, null, disposables);
            }
            else if (ev == 'onFileSystem') {
                for (let doc of workspace_1.default.documents) {
                    let u = vscode_uri_1.URI.parse(doc.uri);
                    if (u.scheme == parts[1]) {
                        await active();
                        return;
                    }
                }
                workspace_1.default.onDidOpenTextDocument(document => {
                    let u = vscode_uri_1.URI.parse(document.uri);
                    if (u.scheme == parts[1]) {
                        active().logError();
                    }
                }, null, disposables);
            }
            else {
                workspace_1.default.showMessage(`Unsupported event ${eventName} of ${id}`, 'error');
            }
        }
    }
    createExtension(root, packageJSON, type) {
        let id = packageJSON.name;
        let isActive = false;
        let exports = null;
        let filename = path_1.default.join(root, packageJSON.main || 'index.js');
        let ext;
        let subscriptions = [];
        let extension = {
            activate: async () => {
                if (isActive)
                    return exports;
                let context = {
                    subscriptions,
                    extensionPath: root,
                    globalState: this.memos.createMemento(`${id}|global`),
                    workspaceState: this.memos.createMemento(`${id}|${workspace_1.default.rootPath}`),
                    asAbsolutePath: relativePath => path_1.default.join(root, relativePath),
                    storagePath: path_1.default.join(this.root, `${id}-data`),
                    logger: createLogger(id)
                };
                isActive = true;
                if (!ext) {
                    try {
                        let isEmpty = !(packageJSON.engines || {}).hasOwnProperty('coc');
                        ext = factory_1.createExtension(id, filename, isEmpty);
                    }
                    catch (e) {
                        logger.error(`Error on createExtension ${id} from ${filename}`, e);
                        return;
                    }
                }
                try {
                    exports = await Promise.resolve(ext.activate(context));
                    logger.debug('activate:', id);
                }
                catch (e) {
                    isActive = false;
                    logger.error(`Error on active extension ${id}: ${e.stack}`, e);
                }
                return exports;
            }
        };
        Object.defineProperties(extension, {
            id: {
                get: () => id
            },
            packageJSON: {
                get: () => packageJSON
            },
            extensionPath: {
                get: () => root
            },
            isActive: {
                get: () => isActive
            },
            exports: {
                get: () => exports
            }
        });
        this.extensions.set(id, {
            id,
            type,
            isLocal: type == types_1.ExtensionType.Local,
            extension,
            directory: root,
            filepath: filename,
            deactivate: () => {
                if (!isActive)
                    return;
                isActive = false;
                util_2.disposeAll(subscriptions);
                subscriptions.splice(0, subscriptions.length);
                subscriptions = [];
                if (ext && ext.deactivate) {
                    try {
                        return Promise.resolve(ext.deactivate()).catch(e => {
                            logger.error(`Error on ${id} deactivate: `, e);
                        });
                    }
                    catch (e) {
                        logger.error(`Error on ${id} deactivate: `, e);
                    }
                }
            }
        });
        let { contributes } = packageJSON;
        if (contributes) {
            let { configuration, rootPatterns, commands } = contributes;
            if (configuration && configuration.properties) {
                let { properties } = configuration;
                let props = {};
                for (let key of Object.keys(properties)) {
                    let val = properties[key].default;
                    if (val != null)
                        props[key] = val;
                }
                workspace_1.default.configurations.extendsDefaults(props);
            }
            if (rootPatterns && rootPatterns.length) {
                for (let item of rootPatterns) {
                    workspace_1.default.addRootPattern(item.filetype, item.patterns);
                }
            }
            if (commands && commands.length) {
                for (let cmd of commands) {
                    commands_1.default.titles.set(cmd.command, cmd.title);
                }
            }
        }
        this._onDidLoadExtension.fire(extension);
        if (this.activated) {
            this.setupActiveEvents(id, packageJSON).logError();
        }
    }
    // extension must exists as folder and in package.json
    filterGlobalExtensions(names) {
        names = names.map(s => s.replace(/@.*$/, ''));
        let filtered = names.filter(name => !this.disabled.has(name));
        filtered = filtered.filter(name => !this.extensions.has(name));
        let json = this.loadJson();
        let urls = [];
        let exists = [];
        if (json && json.dependencies) {
            for (let key of Object.keys(json.dependencies)) {
                let val = json.dependencies[key];
                if (typeof val !== 'string')
                    continue;
                if (fs_1.default.existsSync(path_1.default.join(this.modulesFolder, key, 'package.json'))) {
                    exists.push(key);
                    if (/^https?:/.test(val)) {
                        urls.push(val);
                    }
                }
            }
        }
        filtered = filtered.filter(str => {
            if (/^https?:/.test(str))
                return !urls.some(url => url.startsWith(str));
            return !exists.includes(str);
        });
        return filtered;
    }
    get modulesFolder() {
        return path_1.default.join(this.root, global.hasOwnProperty('__TEST__') ? '' : 'node_modules');
    }
    canActivate(id) {
        return !this.disabled.has(id) && this.extensions.has(id);
    }
    /**
     * Deactive & unregist extension
     */
    async unloadExtension(id) {
        let item = this.extensions.get(id);
        if (item) {
            await this.deactivate(id);
            this.extensions.delete(id);
            this._onDidUnloadExtension.fire(id);
        }
    }
    /**
     * Check if folder contains extension, return Error
     */
    checkDirectory(folder) {
        try {
            let jsonFile = path_1.default.join(folder, 'package.json');
            if (!fs_1.default.existsSync(jsonFile))
                throw new Error('package.json not found');
            let packageJSON = JSON.parse(fs_1.default.readFileSync(jsonFile, 'utf8'));
            let { name, engines, main } = packageJSON;
            if (!name || !engines)
                throw new Error(`can't find name & engines in package.json`);
            if (!engines || !is_1.objectLiteral(engines)) {
                throw new Error(`invalid engines in ${jsonFile}`);
            }
            if (main && !fs_1.default.existsSync(path_1.default.join(folder, main))) {
                throw new Error(`main file ${main} not found, you may need to build the project.`);
            }
            let keys = Object.keys(engines);
            if (!keys.includes('coc') && !keys.includes('vscode')) {
                throw new Error(`Engines in package.json doesn't have coc or vscode`);
            }
            if (keys.includes('coc')) {
                let required = engines['coc'].replace(/^\^/, '>=');
                if (!semver_1.default.satisfies(workspace_1.default.version, required)) {
                    throw new Error(`Please update coc.nvim, ${packageJSON.name} requires coc.nvim ${engines['coc']}`);
                }
            }
            return true;
        }
        catch (e) {
            return e;
        }
    }
    dispose() {
        util_2.disposeAll(this.disposables);
    }
}
exports.Extensions = Extensions;
exports.default = new Extensions();
//# sourceMappingURL=extensions.js.map