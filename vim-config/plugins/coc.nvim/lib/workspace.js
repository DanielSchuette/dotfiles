"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Workspace = void 0;
const tslib_1 = require("tslib");
const bytes_1 = tslib_1.__importDefault(require("bytes"));
const fast_diff_1 = tslib_1.__importDefault(require("fast-diff"));
const fs_1 = tslib_1.__importDefault(require("fs"));
const mkdirp_1 = tslib_1.__importDefault(require("mkdirp"));
const os_1 = tslib_1.__importDefault(require("os"));
const path_1 = tslib_1.__importDefault(require("path"));
const rimraf_1 = tslib_1.__importDefault(require("rimraf"));
const util_1 = tslib_1.__importDefault(require("util"));
const semver_1 = tslib_1.__importDefault(require("semver"));
const uuid_1 = require("uuid");
const vscode_languageserver_protocol_1 = require("vscode-languageserver-protocol");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const vscode_uri_1 = require("vscode-uri");
const which_1 = tslib_1.__importDefault(require("which"));
const configuration_1 = tslib_1.__importDefault(require("./configuration"));
const shape_1 = tslib_1.__importDefault(require("./configuration/shape"));
const events_1 = tslib_1.__importDefault(require("./events"));
const db_1 = tslib_1.__importDefault(require("./model/db"));
const document_1 = tslib_1.__importDefault(require("./model/document"));
const fileSystemWatcher_1 = tslib_1.__importDefault(require("./model/fileSystemWatcher"));
const menu_1 = tslib_1.__importDefault(require("./model/menu"));
const mru_1 = tslib_1.__importDefault(require("./model/mru"));
const outputChannel_1 = tslib_1.__importDefault(require("./model/outputChannel"));
const resolver_1 = tslib_1.__importDefault(require("./model/resolver"));
const status_1 = tslib_1.__importDefault(require("./model/status"));
const task_1 = tslib_1.__importDefault(require("./model/task"));
const terminal_1 = tslib_1.__importDefault(require("./model/terminal"));
const willSaveHandler_1 = tslib_1.__importDefault(require("./model/willSaveHandler"));
const types_1 = require("./types");
const array_1 = require("./util/array");
const fs_2 = require("./util/fs");
const index_1 = require("./util/index");
const match_1 = require("./util/match");
const mutex_1 = require("./util/mutex");
const position_1 = require("./util/position");
const string_1 = require("./util/string");
const watchman_1 = tslib_1.__importDefault(require("./watchman"));
const object_1 = require("./util/object");
const logger = require('./util/logger')('workspace');
let NAME_SPACE = 1080;
class Workspace {
    constructor() {
        this.keymaps = new Map();
        this.mutex = new mutex_1.Mutex();
        this.resolver = new resolver_1.default();
        this.rootPatterns = new Map();
        this._workspaceFolders = [];
        this._insertMode = false;
        this._cwd = process.cwd();
        this._initialized = false;
        this._attached = false;
        this.buffers = new Map();
        this.autocmdMaxId = 0;
        this.autocmds = new Map();
        this.terminals = new Map();
        this.creatingSources = new Map();
        this.outputChannels = new Map();
        this.schemeProviderMap = new Map();
        this.namespaceMap = new Map();
        this.disposables = [];
        this.watchedOptions = new Set();
        this._dynAutocmd = false;
        this._disposed = false;
        this._onDidOpenDocument = new vscode_languageserver_protocol_1.Emitter();
        this._onDidCloseDocument = new vscode_languageserver_protocol_1.Emitter();
        this._onDidChangeDocument = new vscode_languageserver_protocol_1.Emitter();
        this._onWillSaveDocument = new vscode_languageserver_protocol_1.Emitter();
        this._onDidSaveDocument = new vscode_languageserver_protocol_1.Emitter();
        this._onDidChangeWorkspaceFolders = new vscode_languageserver_protocol_1.Emitter();
        this._onDidChangeConfiguration = new vscode_languageserver_protocol_1.Emitter();
        this._onDidWorkspaceInitialized = new vscode_languageserver_protocol_1.Emitter();
        this._onDidOpenTerminal = new vscode_languageserver_protocol_1.Emitter();
        this._onDidCloseTerminal = new vscode_languageserver_protocol_1.Emitter();
        this._onDidRuntimePathChange = new vscode_languageserver_protocol_1.Emitter();
        this.onDidCloseTerminal = this._onDidCloseTerminal.event;
        this.onDidOpenTerminal = this._onDidOpenTerminal.event;
        this.onDidChangeWorkspaceFolders = this._onDidChangeWorkspaceFolders.event;
        this.onDidOpenTextDocument = this._onDidOpenDocument.event;
        this.onDidCloseTextDocument = this._onDidCloseDocument.event;
        this.onDidChangeTextDocument = this._onDidChangeDocument.event;
        this.onWillSaveTextDocument = this._onWillSaveDocument.event;
        this.onDidSaveTextDocument = this._onDidSaveDocument.event;
        this.onDidChangeConfiguration = this._onDidChangeConfiguration.event;
        this.onDidWorkspaceInitialized = this._onDidWorkspaceInitialized.event;
        this.onDidRuntimePathChange = this._onDidRuntimePathChange.event;
        let json = require('../package.json');
        this.version = json.version;
        this.configurations = this.createConfigurations();
        this.willSaveUntilHandler = new willSaveHandler_1.default(this);
        let cwd = process.cwd();
        if (cwd != os_1.default.homedir() && fs_2.inDirectory(cwd, ['.vim'])) {
            this._workspaceFolders.push({
                uri: vscode_uri_1.URI.file(cwd).toString(),
                name: path_1.default.basename(cwd)
            });
        }
        this.setMessageLevel();
    }
    async init() {
        let { nvim } = this;
        this.statusLine = new status_1.default(nvim);
        this._env = await nvim.call('coc#util#vim_info');
        this._insertMode = this._env.mode.startsWith('insert');
        this.menu = new menu_1.default(nvim, this._env);
        let preferences = this.getConfiguration('coc.preferences');
        let maxFileSize = preferences.get('maxFileSize', '10MB');
        this.maxFileSize = bytes_1.default.parse(maxFileSize);
        if (this._env.workspaceFolders) {
            this._workspaceFolders = this._env.workspaceFolders.map(f => ({
                uri: vscode_uri_1.URI.file(f).toString(),
                name: path_1.default.dirname(f)
            }));
        }
        this.configurations.updateUserConfig(this._env.config);
        events_1.default.on('InsertEnter', () => {
            this._insertMode = true;
        }, null, this.disposables);
        events_1.default.on('InsertLeave', () => {
            this._insertMode = false;
        }, null, this.disposables);
        events_1.default.on('BufWinLeave', (_, winid) => {
            this.nvim.call('coc#util#clear_pos_matches', ['^Coc', winid], true);
        }, null, this.disposables);
        events_1.default.on('BufEnter', this.onBufEnter, this, this.disposables);
        events_1.default.on('CursorMoved', this.checkCurrentBuffer, this, this.disposables);
        events_1.default.on('CursorMovedI', this.checkCurrentBuffer, this, this.disposables);
        events_1.default.on('DirChanged', this.onDirChanged, this, this.disposables);
        events_1.default.on('BufCreate', this.onBufCreate, this, this.disposables);
        events_1.default.on('BufUnload', this.onBufUnload, this, this.disposables);
        events_1.default.on('TermOpen', this.onBufCreate, this, this.disposables);
        events_1.default.on('TermClose', this.onBufUnload, this, this.disposables);
        events_1.default.on('BufWritePost', this.onBufWritePost, this, this.disposables);
        events_1.default.on('BufWritePre', this.onBufWritePre, this, this.disposables);
        events_1.default.on('FileType', this.onFileTypeChange, this, this.disposables);
        events_1.default.on('CursorHold', this.checkCurrentBuffer, this, this.disposables);
        events_1.default.on('TextChanged', this.checkBuffer, this, this.disposables);
        events_1.default.on('BufReadCmd', this.onBufReadCmd, this, this.disposables);
        events_1.default.on('VimResized', (columns, lines) => {
            Object.assign(this._env, { columns, lines });
        }, null, this.disposables);
        await this.attach();
        this.attachChangedEvents();
        this.configurations.onDidChange(e => {
            this._onDidChangeConfiguration.fire(e);
        }, null, this.disposables);
        this.watchOption('runtimepath', (oldValue, newValue) => {
            let result = fast_diff_1.default(oldValue, newValue);
            for (let [changeType, value] of result) {
                if (changeType == 1) {
                    let paths = value.replace(/,$/, '').split(',');
                    this._onDidRuntimePathChange.fire(paths);
                }
            }
            this._env.runtimepath = newValue;
        }, this.disposables);
        this.watchOption('iskeyword', (_, newValue) => {
            let doc = this.getDocument(this.bufnr);
            if (doc)
                doc.setIskeyword(newValue);
        }, this.disposables);
        this.watchOption('completeopt', async (_, newValue) => {
            this.env.completeOpt = newValue;
            if (!this._attached)
                return;
            if (this.insertMode) {
                let suggest = this.getConfiguration('suggest');
                if (suggest.get('autoTrigger') == 'always') {
                    let content = await this.nvim.call('execute', ['verbose set completeopt']);
                    let lines = content.split(/\r?\n/);
                    console.error(`Some plugin change completeopt on insert mode: ${lines[lines.length - 1].trim()}!`);
                }
            }
        }, this.disposables);
        this.watchGlobal('coc_sources_disable_map', async (_, newValue) => {
            this.env.disabledSources = newValue;
        });
        let provider = {
            onDidChange: null,
            provideTextDocumentContent: async (uri) => {
                let channel = this.outputChannels.get(uri.path.slice(1));
                if (!channel)
                    return '';
                nvim.pauseNotification();
                nvim.command('setlocal nospell nofoldenable nowrap noswapfile', true);
                nvim.command('setlocal buftype=nofile bufhidden=hide', true);
                nvim.command('setfiletype log', true);
                await nvim.resumeNotification();
                return channel.content;
            }
        };
        this.disposables.push(this.registerTextDocumentContentProvider('output', provider));
    }
    getConfigFile(target) {
        return this.configurations.getConfigFile(target);
    }
    /**
     * Register autocmd on vim.
     */
    registerAutocmd(autocmd) {
        this.autocmdMaxId += 1;
        let id = this.autocmdMaxId;
        this.autocmds.set(id, autocmd);
        this.setupDynamicAutocmd();
        return vscode_languageserver_protocol_1.Disposable.create(() => {
            this.autocmds.delete(id);
            this.setupDynamicAutocmd();
        });
    }
    /**
     * Watch for option change.
     */
    watchOption(key, callback, disposables) {
        let watching = this.watchedOptions.has(key);
        if (!watching) {
            this.watchedOptions.add(key);
            this.setupDynamicAutocmd();
        }
        let disposable = events_1.default.on('OptionSet', async (changed, oldValue, newValue) => {
            if (changed == key && callback) {
                await Promise.resolve(callback(oldValue, newValue));
            }
        });
        if (disposables) {
            disposables.push(vscode_languageserver_protocol_1.Disposable.create(() => {
                disposable.dispose();
                if (watching)
                    return;
                this.watchedOptions.delete(key);
                this.setupDynamicAutocmd();
            }));
        }
    }
    /**
     * Watch global variable, works on neovim only.
     */
    watchGlobal(key, callback, disposables) {
        let { nvim } = this;
        nvim.call('coc#_watch', key, true);
        let disposable = events_1.default.on('GlobalChange', async (changed, oldValue, newValue) => {
            if (changed == key && callback) {
                await Promise.resolve(callback(oldValue, newValue));
            }
        });
        if (disposables) {
            disposables.push(vscode_languageserver_protocol_1.Disposable.create(() => {
                disposable.dispose();
                nvim.call('coc#_unwatch', key, true);
            }));
        }
    }
    get cwd() {
        return this._cwd;
    }
    get env() {
        return this._env;
    }
    get root() {
        return this._root || this.cwd;
    }
    get rootPath() {
        return this.root;
    }
    get workspaceFolders() {
        return this._workspaceFolders;
    }
    /**
     * uri of current file, could be null
     */
    get uri() {
        let { bufnr } = this;
        if (bufnr) {
            let document = this.getDocument(bufnr);
            if (document && document.schema == 'file') {
                return document.uri;
            }
        }
        return null;
    }
    get workspaceFolder() {
        let { rootPath } = this;
        if (rootPath == os_1.default.homedir())
            return null;
        return {
            uri: vscode_uri_1.URI.file(rootPath).toString(),
            name: path_1.default.basename(rootPath)
        };
    }
    async openLocalConfig() {
        let { root } = this;
        if (root == os_1.default.homedir()) {
            this.showMessage(`Can't create local config in home directory`, 'warning');
            return;
        }
        let dir = path_1.default.join(root, '.vim');
        if (!fs_1.default.existsSync(dir)) {
            let res = await this.showPrompt(`Would you like to create folder'${root}/.vim'?`);
            if (!res)
                return;
            fs_1.default.mkdirSync(dir);
        }
        await this.jumpTo(vscode_uri_1.URI.file(path_1.default.join(dir, index_1.CONFIG_FILE_NAME)).toString());
    }
    get textDocuments() {
        let docs = [];
        for (let b of this.buffers.values()) {
            docs.push(b.textDocument);
        }
        return docs;
    }
    get documents() {
        return Array.from(this.buffers.values());
    }
    createNameSpace(name = '') {
        if (this.namespaceMap.has(name))
            return this.namespaceMap.get(name);
        NAME_SPACE = NAME_SPACE + 1;
        this.namespaceMap.set(name, NAME_SPACE);
        return NAME_SPACE;
    }
    get channelNames() {
        return Array.from(this.outputChannels.keys());
    }
    get pluginRoot() {
        return path_1.default.dirname(__dirname);
    }
    get isVim() {
        return this._env.isVim;
    }
    get isNvim() {
        return !this._env.isVim;
    }
    get completeOpt() {
        return this._env.completeOpt;
    }
    get initialized() {
        return this._initialized;
    }
    get ready() {
        if (this._initialized)
            return Promise.resolve();
        return new Promise(resolve => {
            let disposable = this.onDidWorkspaceInitialized(() => {
                disposable.dispose();
                resolve();
            });
        });
    }
    /**
     * Current filetypes.
     */
    get filetypes() {
        let res = new Set();
        for (let doc of this.documents) {
            res.add(doc.filetype);
        }
        return res;
    }
    /**
     * Check if selector match document.
     */
    match(selector, document) {
        return match_1.score(selector, document.uri, document.languageId);
    }
    /**
     * Findup for filename or filenames from current filepath or root.
     */
    async findUp(filename) {
        let { cwd } = this;
        let filepath = await this.nvim.call('expand', '%:p');
        filepath = path_1.default.normalize(filepath);
        let isFile = filepath && path_1.default.isAbsolute(filepath);
        if (isFile && !fs_2.isParentFolder(cwd, filepath, true)) {
            // can't use cwd
            return fs_2.findUp(filename, path_1.default.dirname(filepath));
        }
        let res = fs_2.findUp(filename, cwd);
        if (res && res != os_1.default.homedir())
            return res;
        if (isFile)
            return fs_2.findUp(filename, path_1.default.dirname(filepath));
        return null;
    }
    // eslint-disable-next-line @typescript-eslint/require-await
    async resolveRootFolder(uri, patterns) {
        let { cwd } = this;
        if (uri.scheme != 'file')
            return cwd;
        let filepath = path_1.default.normalize(uri.fsPath);
        let dir = path_1.default.dirname(filepath);
        return fs_2.resolveRoot(dir, patterns) || dir;
    }
    /**
     * Create a FileSystemWatcher instance,
     * doesn't fail when watchman not found.
     */
    createFileSystemWatcher(globPattern, ignoreCreate, ignoreChange, ignoreDelete) {
        let watchmanPath = global.hasOwnProperty('__TEST__') ? null : this.getWatchmanPath();
        let channel = watchmanPath ? this.createOutputChannel('watchman') : null;
        let promise = watchmanPath ? watchman_1.default.createClient(watchmanPath, this.root, channel) : Promise.resolve(null);
        let watcher = new fileSystemWatcher_1.default(promise, globPattern, !!ignoreCreate, !!ignoreChange, !!ignoreDelete);
        return watcher;
    }
    getWatchmanPath() {
        const preferences = this.getConfiguration('coc.preferences');
        let watchmanPath = preferences.get('watchmanPath', 'watchman');
        try {
            return which_1.default.sync(watchmanPath);
        }
        catch (e) {
            return null;
        }
    }
    /**
     * Get configuration by section and optional resource uri.
     */
    getConfiguration(section, resource) {
        return this.configurations.getConfiguration(section, resource);
    }
    /**
     * Get created document by uri or bufnr.
     */
    getDocument(uri) {
        if (typeof uri === 'number') {
            return this.buffers.get(uri);
        }
        const caseInsensitive = index_1.platform.isWindows || index_1.platform.isMacintosh;
        uri = vscode_uri_1.URI.parse(uri).toString();
        for (let doc of this.buffers.values()) {
            if (!doc)
                continue;
            if (doc.uri === uri)
                return doc;
            if (caseInsensitive && doc.uri.toLowerCase() === uri.toLowerCase())
                return doc;
        }
        return null;
    }
    /**
     * Get current cursor offset in document.
     */
    async getOffset() {
        let document = await this.document;
        let pos = await this.getCursorPosition();
        let doc = vscode_languageserver_textdocument_1.TextDocument.create('file:///1', '', 0, document.getDocumentContent());
        return doc.offsetAt(pos);
    }
    /**
     * Apply WorkspaceEdit.
     */
    async applyEdit(edit) {
        let { nvim } = this;
        let { documentChanges, changes } = edit;
        let [bufnr, cursor] = await nvim.eval('[bufnr("%"),coc#util#cursor()]');
        let document = this.getDocument(bufnr);
        let uri = document ? document.uri : null;
        let currEdits = null;
        let locations = [];
        let changeCount = 0;
        const preferences = this.getConfiguration('coc.preferences');
        let promptUser = !global.hasOwnProperty('__TEST__') && preferences.get('promptWorkspaceEdit', true);
        let listTarget = preferences.get('listOfWorkspaceEdit', 'quickfix');
        try {
            if (documentChanges && documentChanges.length) {
                let changedUris = this.getChangedUris(documentChanges);
                changeCount = changedUris.length;
                if (promptUser) {
                    let diskCount = 0;
                    for (let uri of changedUris) {
                        if (!this.getDocument(uri)) {
                            diskCount = diskCount + 1;
                        }
                    }
                    if (diskCount) {
                        let res = await this.showPrompt(`${diskCount} documents on disk would be loaded for change, confirm?`);
                        if (!res)
                            return;
                    }
                }
                let changedMap = new Map();
                // let changes: Map<string, TextEdit[]> = new Map()
                let textEdits = [];
                for (let i = 0; i < documentChanges.length; i++) {
                    let change = documentChanges[i];
                    if (vscode_languageserver_protocol_1.TextDocumentEdit.is(change)) {
                        let { textDocument, edits } = change;
                        let next = documentChanges[i + 1];
                        textEdits.push(...edits);
                        if (next && vscode_languageserver_protocol_1.TextDocumentEdit.is(next) && object_1.equals((next).textDocument, textDocument)) {
                            continue;
                        }
                        let doc = await this.loadFile(textDocument.uri);
                        if (textDocument.uri == uri)
                            currEdits = textEdits;
                        await doc.applyEdits(textEdits);
                        for (let edit of textEdits) {
                            locations.push({ uri: doc.uri, range: edit.range });
                        }
                        textEdits = [];
                    }
                    else if (vscode_languageserver_protocol_1.CreateFile.is(change)) {
                        let file = vscode_uri_1.URI.parse(change.uri).fsPath;
                        await this.createFile(file, change.options);
                    }
                    else if (vscode_languageserver_protocol_1.RenameFile.is(change)) {
                        changedMap.set(change.oldUri, change.newUri);
                        await this.renameFile(vscode_uri_1.URI.parse(change.oldUri).fsPath, vscode_uri_1.URI.parse(change.newUri).fsPath, change.options);
                    }
                    else if (vscode_languageserver_protocol_1.DeleteFile.is(change)) {
                        await this.deleteFile(vscode_uri_1.URI.parse(change.uri).fsPath, change.options);
                    }
                }
                // fix location uris on renameFile
                if (changedMap.size) {
                    locations.forEach(location => {
                        let newUri = changedMap.get(location.uri);
                        if (newUri)
                            location.uri = newUri;
                    });
                }
            }
            else if (changes) {
                let uris = Object.keys(changes);
                let unloaded = uris.filter(uri => this.getDocument(uri) == null);
                if (unloaded.length) {
                    if (promptUser) {
                        let res = await this.showPrompt(`${unloaded.length} documents on disk would be loaded for change, confirm?`);
                        if (!res)
                            return;
                    }
                    await this.loadFiles(unloaded);
                }
                for (let uri of Object.keys(changes)) {
                    let document = this.getDocument(uri);
                    if (vscode_uri_1.URI.parse(uri).toString() == uri)
                        currEdits = changes[uri];
                    let edits = changes[uri];
                    for (let edit of edits) {
                        locations.push({ uri: document.uri, range: edit.range });
                    }
                    await document.applyEdits(edits);
                }
                changeCount = uris.length;
            }
            if (currEdits) {
                let changed = position_1.getChangedFromEdits({ line: cursor[0], character: cursor[1] }, currEdits);
                if (changed)
                    await this.moveTo({
                        line: cursor[0] + changed.line,
                        character: cursor[1] + changed.character
                    });
            }
            if (locations.length) {
                let items = await Promise.all(locations.map(loc => this.getQuickfixItem(loc)));
                let silent = locations.every(l => l.uri == uri);
                if (listTarget == 'quickfix') {
                    await this.nvim.call('setqflist', [items]);
                    if (!silent)
                        this.showMessage(`changed ${changeCount} buffers, use :wa to save changes to disk and :copen to open quickfix list`, 'more');
                }
                else if (listTarget == 'location') {
                    await nvim.setVar('coc_jump_locations', items);
                    if (!silent)
                        this.showMessage(`changed ${changeCount} buffers, use :wa to save changes to disk and :CocList location to manage changed locations`, 'more');
                }
            }
        }
        catch (e) {
            logger.error(e);
            this.showMessage(`Error on applyEdits: ${e.message}`, 'error');
            return false;
        }
        await index_1.wait(50);
        return true;
    }
    /**
     * Convert location to quickfix item.
     */
    async getQuickfixItem(loc, text, type = '', module) {
        if (vscode_languageserver_protocol_1.LocationLink.is(loc)) {
            loc = vscode_languageserver_protocol_1.Location.create(loc.targetUri, loc.targetRange);
        }
        let doc = this.getDocument(loc.uri);
        let { uri, range } = loc;
        let { line, character } = range.start;
        let u = vscode_uri_1.URI.parse(uri);
        let bufnr = doc ? doc.bufnr : -1;
        if (!text && u.scheme == 'file') {
            text = await this.getLine(uri, line);
            character = string_1.byteIndex(text, character);
        }
        let item = {
            uri,
            filename: u.scheme == 'file' ? u.fsPath : uri,
            lnum: line + 1,
            col: character + 1,
            text: text || '',
            range
        };
        if (module)
            item.module = module;
        if (type)
            item.type = type;
        if (bufnr != -1)
            item.bufnr = bufnr;
        return item;
    }
    /**
     * Create persistence Mru instance.
     */
    createMru(name) {
        return new mru_1.default(name);
    }
    /**
     * Get selected range for current document
     */
    async getSelectedRange(mode, document) {
        let { nvim } = this;
        if (mode == 'n') {
            let line = await nvim.call('line', ['.']);
            let content = document.getline(line - 1);
            if (!content.length)
                return null;
            return vscode_languageserver_protocol_1.Range.create(line - 1, 0, line - 1, content.length);
        }
        if (!['v', 'V', 'char', 'line', '\x16'].includes(mode)) {
            throw new Error(`Mode '${mode}' not supported`);
        }
        let isVisual = ['v', 'V', '\x16'].includes(mode);
        let [, sl, sc] = await nvim.call('getpos', isVisual ? `'<` : `'[`);
        let [, el, ec] = await nvim.call('getpos', isVisual ? `'>` : `']`);
        let range = vscode_languageserver_protocol_1.Range.create(document.getPosition(sl, sc), document.getPosition(el, ec));
        if (mode == 'v' || mode == '\x16') {
            range.end.character = range.end.character + 1;
        }
        return range;
    }
    /**
     * Visual select range of current document
     */
    async selectRange(range) {
        let { nvim } = this;
        let { start, end } = range;
        let [bufnr, ve, selection] = await nvim.eval(`[bufnr('%'), &virtualedit, &selection, mode()]`);
        let document = this.getDocument(bufnr);
        if (!document)
            return;
        let line = document.getline(start.line);
        let col = line ? string_1.byteLength(line.slice(0, start.character)) : 0;
        let endLine = document.getline(end.line);
        let endCol = endLine ? string_1.byteLength(endLine.slice(0, end.character)) : 0;
        let move_cmd = '';
        let resetVirtualEdit = false;
        move_cmd += 'v';
        endCol = await nvim.eval(`virtcol([${end.line + 1}, ${endCol}])`);
        if (selection == 'inclusive') {
            if (end.character == 0) {
                move_cmd += `${end.line}G`;
            }
            else {
                move_cmd += `${end.line + 1}G${endCol}|`;
            }
        }
        else if (selection == 'old') {
            move_cmd += `${end.line + 1}G${endCol}|`;
        }
        else {
            move_cmd += `${end.line + 1}G${endCol + 1}|`;
        }
        col = await nvim.eval(`virtcol([${start.line + 1}, ${col}])`);
        move_cmd += `o${start.line + 1}G${col + 1}|o`;
        nvim.pauseNotification();
        if (ve != 'onemore') {
            resetVirtualEdit = true;
            nvim.setOption('virtualedit', 'onemore', true);
        }
        nvim.command(`noa call cursor(${start.line + 1},${col + (move_cmd == 'a' ? 0 : 1)})`, true);
        // nvim.call('eval', [`feedkeys("${move_cmd}", 'in')`], true)
        nvim.command(`normal! ${move_cmd}`, true);
        if (resetVirtualEdit)
            nvim.setOption('virtualedit', ve, true);
        if (this.isVim)
            nvim.command('redraw', true);
        await nvim.resumeNotification();
    }
    /**
     * Populate locations to UI.
     */
    async showLocations(locations) {
        let items = await Promise.all(locations.map(loc => this.getQuickfixItem(loc)));
        let { nvim } = this;
        const preferences = this.getConfiguration('coc.preferences');
        if (preferences.get('useQuickfixForLocations', false)) {
            let openCommand = await nvim.getVar('coc_quickfix_open_command');
            if (typeof openCommand != 'string') {
                openCommand = items.length < 10 ? `copen ${items.length}` : 'copen';
            }
            nvim.pauseNotification();
            nvim.call('setqflist', [items], true);
            nvim.command(openCommand, true);
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            nvim.resumeNotification(false, true);
        }
        else {
            await nvim.setVar('coc_jump_locations', items);
            if (this.env.locationlist) {
                nvim.command('CocList --normal --auto-preview location', true);
            }
            else {
                nvim.call('coc#util#do_autocmd', ['CocLocationsChange'], true);
            }
        }
    }
    /**
     * Get content of line by uri and line.
     */
    async getLine(uri, line) {
        let document = this.getDocument(uri);
        if (document)
            return document.getline(line) || '';
        if (!uri.startsWith('file:'))
            return '';
        return await fs_2.readFileLine(vscode_uri_1.URI.parse(uri).fsPath, line);
    }
    /**
     * Get position for matchaddpos from range & uri
     */
    async getHighlightPositions(uri, range) {
        let res = [];
        if (position_1.comparePosition(range.start, range.end) == 0)
            return [];
        let arr = [];
        for (let i = range.start.line; i <= range.end.line; i++) {
            let curr = await this.getLine(uri, range.start.line);
            if (!curr)
                continue;
            let sc = i == range.start.line ? range.start.character : 0;
            let ec = i == range.end.line ? range.end.character : curr.length;
            if (sc == ec)
                continue;
            arr.push([vscode_languageserver_protocol_1.Range.create(i, sc, i, ec), curr]);
        }
        for (let [r, line] of arr) {
            let start = string_1.byteIndex(line, r.start.character) + 1;
            let end = string_1.byteIndex(line, r.end.character) + 1;
            res.push([r.start.line + 1, start, end - start]);
        }
        return res;
    }
    /**
     * Get WorkspaceFolder of uri
     */
    getWorkspaceFolder(uri) {
        this.workspaceFolders.sort((a, b) => b.uri.length - a.uri.length);
        let filepath = vscode_uri_1.URI.parse(uri).fsPath;
        return this.workspaceFolders.find(folder => fs_2.isParentFolder(vscode_uri_1.URI.parse(folder.uri).fsPath, filepath, true));
    }
    /**
     * Get content from buffer of file by uri.
     */
    async readFile(uri) {
        let document = this.getDocument(uri);
        if (document) {
            await document.patchChange();
            return document.content;
        }
        let u = vscode_uri_1.URI.parse(uri);
        if (u.scheme != 'file')
            return '';
        let encoding = await this.getFileEncoding();
        return await fs_2.readFile(u.fsPath, encoding);
    }
    getFilepath(filepath) {
        let { cwd } = this;
        let rel = path_1.default.relative(cwd, filepath);
        return rel.startsWith('..') ? filepath : rel;
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    onWillSaveUntil(callback, thisArg, clientId) {
        return this.willSaveUntilHandler.addCallback(callback, thisArg, clientId);
    }
    /**
     * Echo lines.
     */
    async echoLines(lines, truncate = false) {
        let { nvim } = this;
        let cmdHeight = this.env.cmdheight;
        if (lines.length > cmdHeight && truncate) {
            lines = lines.slice(0, cmdHeight);
        }
        let maxLen = this.env.columns - 12;
        lines = lines.map(line => {
            line = line.replace(/\n/g, ' ');
            if (truncate)
                line = line.slice(0, maxLen);
            return line;
        });
        if (truncate && lines.length == cmdHeight) {
            let last = lines[lines.length - 1];
            lines[cmdHeight - 1] = `${last.length == maxLen ? last.slice(0, -4) : last} ...`;
        }
        await nvim.call('coc#util#echo_lines', [lines]);
    }
    /**
     * Show message in vim.
     */
    showMessage(msg, identify = 'more') {
        if (this.mutex.busy || !this.nvim)
            return;
        let { messageLevel } = this;
        let method = process.env.VIM_NODE_RPC == '1' ? 'callTimer' : 'call';
        let hl = 'Error';
        let level = types_1.MessageLevel.Error;
        switch (identify) {
            case 'more':
                level = types_1.MessageLevel.More;
                hl = 'MoreMsg';
                break;
            case 'warning':
                level = types_1.MessageLevel.Warning;
                hl = 'WarningMsg';
                break;
        }
        if (level >= messageLevel) {
            this.nvim[method]('coc#util#echo_messages', [hl, ('[coc.nvim] ' + msg).split('\n')], true);
        }
    }
    /**
     * Current document.
     */
    get document() {
        let { bufnr } = this;
        if (bufnr == null)
            return null;
        if (this.buffers.has(bufnr)) {
            return Promise.resolve(this.buffers.get(bufnr));
        }
        if (!this.creatingSources.has(bufnr)) {
            this.onBufCreate(bufnr).logError();
        }
        return new Promise(resolve => {
            let disposable = this.onDidOpenTextDocument(doc => {
                disposable.dispose();
                resolve(this.getDocument(doc.uri));
            });
        });
    }
    /**
     * Get current cursor position.
     */
    async getCursorPosition() {
        let [line, character] = await this.nvim.call('coc#util#cursor');
        return vscode_languageserver_protocol_1.Position.create(line, character);
    }
    /**
     * Get current document and position.
     */
    async getCurrentState() {
        let document = await this.document;
        let position = await this.getCursorPosition();
        return {
            document: document.textDocument,
            position
        };
    }
    /**
     * Get format options
     */
    async getFormatOptions(uri) {
        let doc;
        if (uri)
            doc = this.getDocument(uri);
        let bufnr = doc ? doc.bufnr : 0;
        let [tabSize, insertSpaces] = await this.nvim.call('coc#util#get_format_opts', [bufnr]);
        return {
            tabSize,
            insertSpaces: insertSpaces == 1
        };
    }
    /**
     * Jump to location.
     */
    async jumpTo(uri, position, openCommand) {
        const preferences = this.getConfiguration('coc.preferences');
        let jumpCommand = openCommand || preferences.get('jumpCommand', 'edit');
        let { nvim } = this;
        let doc = this.getDocument(uri);
        let bufnr = doc ? doc.bufnr : -1;
        if (bufnr != -1 && jumpCommand == 'edit') {
            // use buffer command since edit command would reload the buffer
            nvim.pauseNotification();
            nvim.command(`silent! normal! m'`, true);
            nvim.command(`buffer ${bufnr}`, true);
            if (position) {
                let line = doc.getline(position.line);
                let col = string_1.byteLength(line.slice(0, position.character)) + 1;
                nvim.call('cursor', [position.line + 1, col], true);
            }
            if (this.isVim)
                nvim.command('redraw', true);
            await nvim.resumeNotification();
        }
        else {
            let { fsPath, scheme } = vscode_uri_1.URI.parse(uri);
            let pos = position == null ? null : [position.line, position.character];
            if (scheme == 'file') {
                let bufname = fs_2.fixDriver(path_1.default.normalize(fsPath));
                await this.nvim.call('coc#util#jump', [jumpCommand, bufname, pos]);
            }
            else {
                await this.nvim.call('coc#util#jump', [jumpCommand, uri, pos]);
            }
        }
    }
    /**
     * Move cursor to position.
     */
    async moveTo(position) {
        await this.nvim.call('coc#util#jumpTo', [position.line, position.character]);
        if (this.isVim)
            this.nvim.command('redraw', true);
    }
    /**
     * Create a file in vim and disk
     */
    async createFile(filepath, opts = {}) {
        let stat = await fs_2.statAsync(filepath);
        if (stat && !opts.overwrite && !opts.ignoreIfExists) {
            this.showMessage(`${filepath} already exists!`, 'error');
            return;
        }
        if (!stat || opts.overwrite) {
            // directory
            if (filepath.endsWith('/')) {
                try {
                    filepath = this.expand(filepath);
                    await mkdirp_1.default(filepath);
                }
                catch (e) {
                    this.showMessage(`Can't create ${filepath}: ${e.message}`, 'error');
                }
            }
            else {
                let uri = vscode_uri_1.URI.file(filepath).toString();
                let doc = this.getDocument(uri);
                if (doc)
                    return;
                if (!fs_1.default.existsSync(path_1.default.dirname(filepath))) {
                    fs_1.default.mkdirSync(path_1.default.dirname(filepath), { recursive: true });
                }
                let encoding = await this.getFileEncoding();
                fs_1.default.writeFileSync(filepath, '', encoding || '');
                await this.loadFile(uri);
            }
        }
    }
    /**
     * Load uri as document.
     */
    async loadFile(uri) {
        let doc = this.getDocument(uri);
        if (doc)
            return doc;
        let { nvim } = this;
        let filepath = uri.startsWith('file') ? vscode_uri_1.URI.parse(uri).fsPath : uri;
        nvim.call('coc#util#open_files', [[filepath]], true);
        return await new Promise((resolve, reject) => {
            let disposable = this.onDidOpenTextDocument(textDocument => {
                let fsPath = vscode_uri_1.URI.parse(textDocument.uri).fsPath;
                if (textDocument.uri == uri || fsPath == filepath) {
                    clearTimeout(timer);
                    disposable.dispose();
                    resolve(this.getDocument(uri));
                }
            });
            let timer = setTimeout(() => {
                disposable.dispose();
                reject(new Error(`Create document ${uri} timeout after 1s.`));
            }, 1000);
        });
    }
    /**
     * Load the files that not loaded
     */
    async loadFiles(uris) {
        uris = uris.filter(uri => this.getDocument(uri) == null);
        if (!uris.length)
            return;
        let bufnrs = await this.nvim.call('coc#util#open_files', [uris.map(u => vscode_uri_1.URI.parse(u).fsPath)]);
        let create = bufnrs.filter(bufnr => this.getDocument(bufnr) == null);
        if (!create.length)
            return;
        create.map(bufnr => this.onBufCreate(bufnr).logError());
        return new Promise((resolve, reject) => {
            let timer = setTimeout(() => {
                disposable.dispose();
                reject(new Error(`Create document timeout after 2s.`));
            }, 2000);
            let disposable = this.onDidOpenTextDocument(() => {
                if (uris.every(uri => this.getDocument(uri) != null)) {
                    clearTimeout(timer);
                    disposable.dispose();
                    resolve();
                }
            });
        });
    }
    /**
     * Rename file in vim and disk
     */
    async renameFile(oldPath, newPath, opts = {}) {
        let { overwrite, ignoreIfExists } = opts;
        let { nvim } = this;
        try {
            let stat = await fs_2.statAsync(newPath);
            if (stat && !overwrite && !ignoreIfExists) {
                throw new Error(`${newPath} already exists`);
            }
            if (!stat || overwrite) {
                let uri = vscode_uri_1.URI.file(oldPath).toString();
                let newUri = vscode_uri_1.URI.file(newPath).toString();
                let doc = this.getDocument(uri);
                let isCurrent = doc.bufnr == this.bufnr;
                let newDoc = this.getDocument(newUri);
                if (newDoc)
                    await this.nvim.command(`silent ${newDoc.bufnr}bwipeout!`);
                if (doc != null) {
                    let content = doc.getDocumentContent();
                    let encoding = await doc.buffer.getOption('fileencoding');
                    await util_1.default.promisify(fs_1.default.writeFile)(newPath, content, { encoding });
                    // open renamed file
                    if (!isCurrent) {
                        await nvim.call('coc#util#open_files', [[newPath]]);
                        await nvim.command(`silent ${doc.bufnr}bwipeout!`);
                    }
                    else {
                        let view = await nvim.call('winsaveview');
                        nvim.pauseNotification();
                        nvim.call('coc#util#open_file', ['keepalt edit', newPath], true);
                        nvim.command(`silent ${doc.bufnr}bwipeout!`, true);
                        nvim.call('winrestview', [view], true);
                        await nvim.resumeNotification();
                    }
                    // avoid vim detect file unlink
                    await util_1.default.promisify(fs_1.default.unlink)(oldPath);
                }
                else {
                    await fs_2.renameAsync(oldPath, newPath);
                }
            }
        }
        catch (e) {
            this.showMessage(`Rename error: ${e.message}`, 'error');
        }
    }
    /**
     * Delete file from vim and disk.
     */
    async deleteFile(filepath, opts = {}) {
        let { ignoreIfNotExists, recursive } = opts;
        let stat = await fs_2.statAsync(filepath.replace(/\/$/, ''));
        let isDir = stat && stat.isDirectory();
        if (filepath.endsWith('/') && !isDir) {
            this.showMessage(`${filepath} is not directory`, 'error');
            return;
        }
        if (!stat && !ignoreIfNotExists) {
            this.showMessage(`${filepath} not exists`, 'error');
            return;
        }
        if (stat == null)
            return;
        if (isDir && !recursive) {
            this.showMessage(`Can't remove directory, recursive not set`, 'error');
            return;
        }
        try {
            if (isDir && recursive) {
                rimraf_1.default.sync(filepath);
            }
            else if (isDir) {
                await util_1.default.promisify(fs_1.default.rmdir)(filepath);
            }
            else {
                await util_1.default.promisify(fs_1.default.unlink)(filepath);
            }
            if (!isDir) {
                let uri = vscode_uri_1.URI.file(filepath).toString();
                let doc = this.getDocument(uri);
                if (doc)
                    await this.nvim.command(`silent! bwipeout! ${doc.bufnr}`);
            }
        }
        catch (e) {
            this.showMessage(`Error on delete ${filepath}: ${e.message}`, 'error');
        }
    }
    /**
     * Open resource by uri
     */
    async openResource(uri) {
        let { nvim } = this;
        // not supported
        if (uri.startsWith('http')) {
            await nvim.call('coc#util#open_url', uri);
            return;
        }
        let wildignore = await nvim.getOption('wildignore');
        await nvim.setOption('wildignore', '');
        await this.jumpTo(uri);
        await nvim.setOption('wildignore', wildignore);
    }
    /**
     * Create a new output channel
     */
    createOutputChannel(name) {
        if (this.outputChannels.has(name))
            return this.outputChannels.get(name);
        let channel = new outputChannel_1.default(name, this.nvim);
        this.outputChannels.set(name, channel);
        return channel;
    }
    /**
     * Reveal buffer of output channel.
     */
    showOutputChannel(name, preserveFocus) {
        let channel = this.outputChannels.get(name);
        if (!channel) {
            this.showMessage(`Channel "${name}" not found`, 'error');
            return;
        }
        channel.show(preserveFocus);
    }
    /**
     * Resovle module from yarn or npm.
     */
    async resolveModule(name) {
        return await this.resolver.resolveModule(name);
    }
    /**
     * Run nodejs command
     */
    async runCommand(cmd, cwd, timeout) {
        cwd = cwd || this.cwd;
        return index_1.runCommand(cmd, { cwd }, timeout);
    }
    /**
     * Run command in vim terminal for result
     */
    async runTerminalCommand(cmd, cwd = this.cwd, keepfocus = false) {
        return await this.nvim.callAsync('coc#util#run_terminal', { cmd, cwd, keepfocus: keepfocus ? 1 : 0 });
    }
    /**
     * Open terminal buffer with cmd & opts
     */
    async openTerminal(cmd, opts = {}) {
        let bufnr = await this.nvim.call('coc#util#open_terminal', Object.assign({ cmd }, opts));
        return bufnr;
    }
    /**
     * Expand filepath with `~` and/or environment placeholders
     */
    expand(filepath) {
        if (!filepath)
            return filepath;
        if (filepath.startsWith('~')) {
            filepath = os_1.default.homedir() + filepath.slice(1);
        }
        if (filepath.includes('$')) {
            let doc = this.getDocument(this.bufnr);
            let fsPath = doc ? vscode_uri_1.URI.parse(doc.uri).fsPath : '';
            filepath = filepath.replace(/\$\{(.*?)\}/g, (match, name) => {
                if (name.startsWith('env:')) {
                    let key = name.split(':')[1];
                    let val = key ? process.env[key] : '';
                    return val;
                }
                switch (name) {
                    case 'workspace':
                    case 'workspaceRoot':
                    case 'workspaceFolder':
                        return this.root;
                    case 'workspaceFolderBasename':
                        return path_1.default.dirname(this.root);
                    case 'cwd':
                        return this.cwd;
                    case 'file':
                        return fsPath;
                    case 'fileDirname':
                        return fsPath ? path_1.default.dirname(fsPath) : '';
                    case 'fileExtname':
                        return fsPath ? path_1.default.extname(fsPath) : '';
                    case 'fileBasename':
                        return fsPath ? path_1.default.basename(fsPath) : '';
                    case 'fileBasenameNoExtension': {
                        let basename = fsPath ? path_1.default.basename(fsPath) : '';
                        return basename ? basename.slice(0, basename.length - path_1.default.extname(basename).length) : '';
                    }
                    default:
                        return match;
                }
            });
            filepath = filepath.replace(/\$[\w]+/g, match => {
                if (match == '$HOME')
                    return os_1.default.homedir();
                return process.env[match.slice(1)] || match;
            });
        }
        return filepath;
    }
    async createTerminal(opts) {
        let cmd = opts.shellPath;
        let args = opts.shellArgs;
        if (!cmd)
            cmd = await this.nvim.getOption('shell');
        let terminal = new terminal_1.default(cmd, args || [], this.nvim, opts.name);
        await terminal.start(opts.cwd || this.cwd, opts.env);
        this.terminals.set(terminal.bufnr, terminal);
        this._onDidOpenTerminal.fire(terminal);
        return terminal;
    }
    /**
     * Show quickpick
     */
    async showQuickpick(items, placeholder = 'Choose by number') {
        let preferences = this.getConfiguration('coc.preferences');
        let floatQuickpick = preferences.get('floatQuickpick', true);
        if (floatQuickpick && this.floatSupported) {
            let { menu } = this;
            menu.show(items);
            let res = await new Promise(resolve => {
                let disposables = [];
                menu.onDidCancel(() => {
                    index_1.disposeAll(disposables);
                    resolve(-1);
                }, null, disposables);
                menu.onDidChoose(idx => {
                    index_1.disposeAll(disposables);
                    resolve(idx);
                }, null, disposables);
            });
            return res;
        }
        let release = await this.mutex.acquire();
        try {
            let title = placeholder + ':';
            items = items.map((s, idx) => `${idx + 1}. ${s}`);
            let res = await this.nvim.callAsync('coc#util#quickpick', [title, items]);
            release();
            let n = parseInt(res, 10);
            if (isNaN(n) || n <= 0 || n > items.length)
                return -1;
            return n - 1;
        }
        catch (e) {
            release();
            return -1;
        }
    }
    /**
     * Prompt for confirm action.
     */
    async showPrompt(title) {
        let release = await this.mutex.acquire();
        try {
            let res = await this.nvim.callAsync('coc#util#prompt', [title]);
            release();
            return !!res;
        }
        catch (e) {
            release();
            return false;
        }
    }
    async callAsync(method, args) {
        if (this.isNvim)
            return await this.nvim.call(method, args);
        return await this.nvim.callAsync('coc#util#with_callback', [method, args]);
    }
    /**
     * Request input from user
     */
    async requestInput(title, defaultValue) {
        let { nvim } = this;
        const preferences = this.getConfiguration('coc.preferences');
        if (this.isNvim && semver_1.default.gte(this.env.version, '0.5.0') && preferences.get('promptInput', true)) {
            let bufnr = await nvim.call('coc#util#create_prompt_win', [title, defaultValue || '']);
            if (!bufnr)
                return null;
            let res = await new Promise(resolve => {
                let disposables = [];
                events_1.default.on('BufUnload', nr => {
                    if (nr == bufnr) {
                        index_1.disposeAll(disposables);
                        resolve(null);
                    }
                }, null, disposables);
                events_1.default.on('InsertLeave', nr => {
                    if (nr == bufnr) {
                        index_1.disposeAll(disposables);
                        setTimeout(() => {
                            nvim.command(`bd! ${nr}`, true);
                        }, 30);
                        resolve(null);
                    }
                }, null, disposables);
                events_1.default.on('PromptInsert', (value, nr) => {
                    if (nr == bufnr) {
                        index_1.disposeAll(disposables);
                        // connection would be broken without timeout, don't know why
                        setTimeout(() => {
                            nvim.command(`stopinsert|bd! ${nr}`, true);
                        }, 30);
                        if (!value) {
                            this.showMessage('Empty word, canceled', 'warning');
                            resolve(null);
                        }
                        else {
                            resolve(value);
                        }
                    }
                }, null, disposables);
            });
            return res;
        }
        let res = await this.callAsync('input', [title + ': ', defaultValue || '']);
        nvim.command('normal! :<C-u>', true);
        if (!res) {
            this.showMessage('Empty word, canceled', 'warning');
            return null;
        }
        return res;
    }
    /**
     * registerTextDocumentContentProvider
     */
    registerTextDocumentContentProvider(scheme, provider) {
        this.schemeProviderMap.set(scheme, provider);
        this.setupDynamicAutocmd();
        let disposables = [];
        if (provider.onDidChange) {
            provider.onDidChange(async (uri) => {
                let doc = this.getDocument(uri.toString());
                if (doc) {
                    let { buffer } = doc;
                    let tokenSource = new vscode_languageserver_protocol_1.CancellationTokenSource();
                    let content = await Promise.resolve(provider.provideTextDocumentContent(uri, tokenSource.token));
                    await buffer.setLines(content.split('\n'), {
                        start: 0,
                        end: -1,
                        strictIndexing: false
                    });
                }
            }, null, disposables);
        }
        return vscode_languageserver_protocol_1.Disposable.create(() => {
            this.schemeProviderMap.delete(scheme);
            index_1.disposeAll(disposables);
            this.setupDynamicAutocmd();
        });
    }
    /**
     * Register unique keymap uses `<Plug>(coc-{key})` as lhs
     * Throw error when {key} already exists.
     *
     * @param {MapMode[]} modes - array of 'n' | 'i' | 'v' | 'x' | 's' | 'o'
     * @param {string} key - unique name
     * @param {Function} fn - callback function
     * @param {Partial} opts
     * @returns {Disposable}
     */
    registerKeymap(modes, key, fn, opts = {}) {
        if (!key)
            throw new Error(`Invalid key ${key} of registerKeymap`);
        if (this.keymaps.has(key))
            throw new Error(`${key} already exists.`);
        opts = Object.assign({ sync: true, cancel: true, silent: true, repeat: false }, opts);
        let { nvim } = this;
        this.keymaps.set(key, [fn, !!opts.repeat]);
        let method = opts.sync ? 'request' : 'notify';
        let silent = opts.silent ? '<silent>' : '';
        for (let m of modes) {
            if (m == 'i') {
                nvim.command(`inoremap ${silent}<expr> <Plug>(coc-${key}) coc#_insert_key('${method}', '${key}', ${opts.cancel ? 1 : 0})`, true);
            }
            else {
                let modify = index_1.getKeymapModifier(m);
                nvim.command(`${m}noremap ${silent} <Plug>(coc-${key}) :${modify}call coc#rpc#${method}('doKeymap', ['${key}'])<cr>`, true);
            }
        }
        return vscode_languageserver_protocol_1.Disposable.create(() => {
            this.keymaps.delete(key);
            for (let m of modes) {
                nvim.command(`${m}unmap <Plug>(coc-${key})`, true);
            }
        });
    }
    /**
     * Register expr keymap.
     */
    registerExprKeymap(mode, key, fn, buffer = false) {
        if (!key)
            return;
        let id = `${mode}${global.Buffer.from(key).toString('base64')}${buffer ? '1' : '0'}`;
        let { nvim } = this;
        this.keymaps.set(id, [fn, false]);
        if (mode == 'i') {
            nvim.command(`inoremap <silent><expr>${buffer ? '<nowait><buffer>' : ''} ${key} coc#_insert_key('request', '${id}')`, true);
        }
        else {
            nvim.command(`${mode}noremap <silent><expr>${buffer ? '<nowait><buffer>' : ''} ${key} coc#rpc#request('doKeymap', ['${id}'])`, true);
        }
        return vscode_languageserver_protocol_1.Disposable.create(() => {
            this.keymaps.delete(id);
            nvim.command(`${mode}unmap ${buffer ? '<buffer>' : ''} ${key}`, true);
        });
    }
    registerLocalKeymap(mode, key, fn, notify = false) {
        let id = uuid_1.v1();
        let { nvim } = this;
        this.keymaps.set(id, [fn, false]);
        let modify = index_1.getKeymapModifier(mode);
        nvim.command(`${mode}noremap <silent><nowait><buffer> ${key} :${modify}call coc#rpc#${notify ? 'notify' : 'request'}('doKeymap', ['${id}'])<CR>`, true);
        return vscode_languageserver_protocol_1.Disposable.create(() => {
            this.keymaps.delete(id);
            nvim.command(`${mode}unmap <buffer> ${key}`, true);
        });
    }
    /**
     * Create StatusBarItem
     */
    createStatusBarItem(priority = 0, opt = {}) {
        if (!this.statusLine) {
            let fn = () => { };
            return { text: '', show: fn, dispose: fn, hide: fn, priority: 0, isProgress: false };
        }
        return this.statusLine.createStatusBarItem(priority, opt.progress || false);
    }
    dispose() {
        this._disposed = true;
        for (let ch of this.outputChannels.values()) {
            ch.dispose();
        }
        for (let doc of this.documents) {
            doc.detach();
        }
        index_1.disposeAll(this.disposables);
        watchman_1.default.dispose();
        this.configurations.dispose();
        this.buffers.clear();
        if (this.statusLine)
            this.statusLine.dispose();
    }
    async detach() {
        if (!this._attached)
            return;
        this._attached = false;
        for (let bufnr of this.buffers.keys()) {
            await events_1.default.fire('BufUnload', [bufnr]);
        }
    }
    /**
     * Create DB instance at extension root.
     */
    createDatabase(name) {
        let root;
        if (global.hasOwnProperty('__TEST__')) {
            root = path_1.default.join(os_1.default.tmpdir(), `coc-${process.pid}`);
            fs_1.default.mkdirSync(root, { recursive: true });
        }
        else {
            root = path_1.default.dirname(this.env.extensionRoot);
        }
        let filepath = path_1.default.join(root, name + '.json');
        return new db_1.default(filepath);
    }
    /**
     * Create Task instance that runs in vim.
     */
    createTask(id) {
        return new task_1.default(this.nvim, id);
    }
    setupDynamicAutocmd(initialize = false) {
        if (!initialize && !this._dynAutocmd)
            return;
        this._dynAutocmd = true;
        let schemes = this.schemeProviderMap.keys();
        let cmds = [];
        for (let scheme of schemes) {
            cmds.push(`autocmd BufReadCmd,FileReadCmd,SourceCmd ${scheme}://* call coc#rpc#request('CocAutocmd', ['BufReadCmd','${scheme}', expand('<amatch>')])`);
        }
        for (let [id, autocmd] of this.autocmds.entries()) {
            let args = autocmd.arglist && autocmd.arglist.length ? ', ' + autocmd.arglist.join(', ') : '';
            let event = Array.isArray(autocmd.event) ? autocmd.event.join(',') : autocmd.event;
            let pattern = autocmd.pattern != null ? autocmd.pattern : '*';
            if (/\buser\b/i.test(event)) {
                pattern = '';
            }
            cmds.push(`autocmd ${event} ${pattern} call coc#rpc#${autocmd.request ? 'request' : 'notify'}('doAutocmd', [${id}${args}])`);
        }
        for (let key of this.watchedOptions) {
            cmds.push(`autocmd OptionSet ${key} call coc#rpc#notify('OptionSet',[expand('<amatch>'), v:option_old, v:option_new])`);
        }
        let content = `
augroup coc_dynamic_autocmd
  autocmd!
  ${cmds.join('\n  ')}
augroup end`;
        try {
            let dir = path_1.default.join(process.env.TMPDIR, `coc.nvim-${process.pid}`);
            if (!fs_1.default.existsSync(dir))
                fs_1.default.mkdirSync(dir, { recursive: true });
            let filepath = path_1.default.join(dir, `coc-${process.pid}.vim`);
            fs_1.default.writeFileSync(filepath, content, 'utf8');
            let cmd = `source ${filepath}`;
            if (this.env.isCygwin && index_1.platform.isWindows) {
                cmd = `execute "source" . substitute(system('cygpath ${filepath.replace(/\\/g, '/')}'), '\\n', '', 'g')`;
            }
            this.nvim.command(cmd).logError();
        }
        catch (e) {
            this.showMessage(`Can't create tmp file: ${e.message}`, 'error');
        }
    }
    async onBufReadCmd(scheme, uri) {
        let provider = this.schemeProviderMap.get(scheme);
        if (!provider) {
            this.showMessage(`Provider for ${scheme} not found`, 'error');
            return;
        }
        let tokenSource = new vscode_languageserver_protocol_1.CancellationTokenSource();
        let content = await Promise.resolve(provider.provideTextDocumentContent(vscode_uri_1.URI.parse(uri), tokenSource.token));
        let buf = await this.nvim.buffer;
        await buf.setLines(content.split('\n'), {
            start: 0,
            end: -1,
            strictIndexing: false
        });
        setTimeout(async () => {
            await events_1.default.fire('BufCreate', [buf.id]);
        }, 30);
    }
    async attach() {
        if (this._attached)
            return;
        this._attached = true;
        let buffers = await this.nvim.buffers;
        let bufnr = this.bufnr = await this.nvim.call('bufnr', '%');
        await Promise.all(buffers.map(buf => this.onBufCreate(buf)));
        if (!this._initialized) {
            this._onDidWorkspaceInitialized.fire(void 0);
            this._initialized = true;
        }
        await events_1.default.fire('BufEnter', [bufnr]);
        let winid = await this.nvim.call('win_getid');
        await events_1.default.fire('BufWinEnter', [bufnr, winid]);
    }
    // count of document need change
    getChangedUris(documentChanges) {
        let uris = new Set();
        let newUris = new Set();
        for (let change of documentChanges) {
            if (vscode_languageserver_protocol_1.TextDocumentEdit.is(change)) {
                let { textDocument } = change;
                let { uri, version } = textDocument;
                if (!newUris.has(uri)) {
                    uris.add(uri);
                }
                if (version != null && version > 0) {
                    let doc = this.getDocument(uri);
                    if (!doc) {
                        throw new Error(`${uri} not loaded`);
                    }
                    if (doc.version != version) {
                        throw new Error(`${uri} changed before apply edit`);
                    }
                }
                else if (fs_2.isFile(uri) && !this.getDocument(uri)) {
                    let file = vscode_uri_1.URI.parse(uri).fsPath;
                    if (!fs_1.default.existsSync(file)) {
                        throw new Error(`file "${file}" not exists`);
                    }
                }
            }
            else if (vscode_languageserver_protocol_1.CreateFile.is(change) || vscode_languageserver_protocol_1.DeleteFile.is(change)) {
                if (!fs_2.isFile(change.uri)) {
                    throw new Error(`change of scheme ${change.uri} not supported`);
                }
                uris.add(change.uri);
            }
            else if (vscode_languageserver_protocol_1.RenameFile.is(change)) {
                if (!fs_2.isFile(change.oldUri) || !fs_2.isFile(change.newUri)) {
                    throw new Error(`change of scheme ${change.oldUri} not supported`);
                }
                let newFile = vscode_uri_1.URI.parse(change.newUri).fsPath;
                if (fs_1.default.existsSync(newFile)) {
                    throw new Error(`file "${newFile}" already exists for rename`);
                }
                uris.add(change.oldUri);
                newUris.add(change.newUri);
            }
            else {
                throw new Error(`Invalid document change: ${JSON.stringify(change, null, 2)}`);
            }
        }
        return Array.from(uris);
    }
    createConfigurations() {
        let home = path_1.default.normalize(process.env.COC_VIMCONFIG) || path_1.default.join(os_1.default.homedir(), '.vim');
        let userConfigFile = path_1.default.join(home, index_1.CONFIG_FILE_NAME);
        return new configuration_1.default(userConfigFile, new shape_1.default(this));
    }
    // events for sync buffer of vim
    attachChangedEvents() {
        if (this.isVim) {
            const onChange = (bufnr) => {
                let doc = this.getDocument(bufnr);
                if (doc && doc.attached)
                    doc.fetchContent();
            };
            events_1.default.on('TextChangedI', onChange, null, this.disposables);
            events_1.default.on('TextChanged', onChange, null, this.disposables);
        }
    }
    async onBufCreate(buf) {
        let buffer = typeof buf === 'number' ? this.nvim.createBuffer(buf) : buf;
        let bufnr = buffer.id;
        if (this.creatingSources.has(bufnr))
            return;
        let document = this.getDocument(bufnr);
        let source = new vscode_languageserver_protocol_1.CancellationTokenSource();
        try {
            if (document)
                this.onBufUnload(bufnr, true);
            document = new document_1.default(buffer, this._env, this.maxFileSize);
            let token = source.token;
            this.creatingSources.set(bufnr, source);
            let created = await document.init(this.nvim, token);
            if (!created)
                document = null;
        }
        catch (e) {
            logger.error('Error on create buffer:', e);
            document = null;
        }
        if (this.creatingSources.get(bufnr) == source) {
            source.dispose();
            this.creatingSources.delete(bufnr);
        }
        if (!document || !document.textDocument)
            return;
        this.buffers.set(bufnr, document);
        if (document.enabled) {
            document.onDocumentDetach(bufnr => {
                let doc = this.getDocument(bufnr);
                if (doc)
                    this.onBufUnload(doc.bufnr);
            });
        }
        if (document.buftype == '' && document.schema == 'file') {
            let config = this.getConfiguration('workspace');
            let filetypes = config.get('ignoredFiletypes', []);
            if (!filetypes.includes(document.filetype)) {
                let root = this.resolveRoot(document);
                if (root) {
                    this.addWorkspaceFolder(root);
                    if (this.bufnr == buffer.id) {
                        this._root = root;
                    }
                }
            }
            this.configurations.checkFolderConfiguration(document.uri);
        }
        if (document.enabled) {
            this._onDidOpenDocument.fire(document.textDocument);
            document.onDocumentChange(e => this._onDidChangeDocument.fire(e));
        }
        logger.debug('buffer created', buffer.id);
    }
    onBufEnter(bufnr) {
        this.bufnr = bufnr;
        let doc = this.getDocument(bufnr);
        if (doc) {
            this.configurations.setFolderConfiguration(doc.uri);
            let workspaceFolder = this.getWorkspaceFolder(doc.uri);
            if (workspaceFolder)
                this._root = vscode_uri_1.URI.parse(workspaceFolder.uri).fsPath;
        }
    }
    async checkCurrentBuffer(bufnr) {
        this.bufnr = bufnr;
        await this.checkBuffer(bufnr);
    }
    onBufWritePost(bufnr) {
        let doc = this.buffers.get(bufnr);
        if (!doc)
            return;
        this._onDidSaveDocument.fire(doc.textDocument);
    }
    onBufUnload(bufnr, recreate = false) {
        logger.debug('buffer unload', bufnr);
        if (!recreate) {
            let source = this.creatingSources.get(bufnr);
            if (source) {
                source.cancel();
                this.creatingSources.delete(bufnr);
            }
        }
        if (this.terminals.has(bufnr)) {
            let terminal = this.terminals.get(bufnr);
            this._onDidCloseTerminal.fire(terminal);
            this.terminals.delete(bufnr);
        }
        let doc = this.buffers.get(bufnr);
        if (doc) {
            this._onDidCloseDocument.fire(doc.textDocument);
            this.buffers.delete(bufnr);
            doc.detach();
        }
    }
    async onBufWritePre(bufnr) {
        let doc = this.buffers.get(bufnr);
        if (!doc)
            return;
        let event = {
            document: doc.textDocument,
            reason: vscode_languageserver_protocol_1.TextDocumentSaveReason.Manual
        };
        this._onWillSaveDocument.fire(event);
        if (this.willSaveUntilHandler.hasCallback) {
            await this.willSaveUntilHandler.handeWillSaveUntil(event);
        }
    }
    onDirChanged(cwd) {
        if (cwd == this._cwd)
            return;
        this._cwd = cwd;
    }
    onFileTypeChange(filetype, bufnr) {
        let doc = this.getDocument(bufnr);
        if (!doc)
            return;
        let converted = doc.convertFiletype(filetype);
        if (converted == doc.filetype)
            return;
        this._onDidCloseDocument.fire(doc.textDocument);
        doc.setFiletype(filetype);
        this._onDidOpenDocument.fire(doc.textDocument);
    }
    async checkBuffer(bufnr) {
        if (this._disposed || !bufnr)
            return;
        let doc = this.getDocument(bufnr);
        if (!doc && !this.creatingSources.has(bufnr))
            await this.onBufCreate(bufnr);
    }
    async getFileEncoding() {
        let encoding = await this.nvim.getOption('fileencoding');
        return encoding ? encoding : 'utf-8';
    }
    resolveRoot(document) {
        let types = [types_1.PatternType.Buffer, types_1.PatternType.LanguageServer, types_1.PatternType.Global];
        let u = vscode_uri_1.URI.parse(document.uri);
        let dir = path_1.default.dirname(u.fsPath);
        let { cwd } = this;
        for (let patternType of types) {
            let patterns = this.getRootPatterns(document, patternType);
            if (patterns && patterns.length) {
                let root = fs_2.resolveRoot(dir, patterns, cwd);
                if (root)
                    return root;
            }
        }
        if (this.cwd != os_1.default.homedir() && fs_2.isParentFolder(this.cwd, dir, true))
            return this.cwd;
        return null;
    }
    getRootPatterns(document, patternType) {
        let { uri } = document;
        if (patternType == types_1.PatternType.Buffer)
            return document.getVar('root_patterns', []) || [];
        if (patternType == types_1.PatternType.LanguageServer)
            return this.getServerRootPatterns(document.filetype);
        const preferences = this.getConfiguration('coc.preferences', uri);
        return preferences.get('rootPatterns', ['.git', '.hg', '.projections.json']).slice();
    }
    async renameCurrent() {
        let { nvim } = this;
        let bufnr = await nvim.call('bufnr', '%');
        let cwd = await nvim.call('getcwd');
        let doc = this.getDocument(bufnr);
        if (!doc || doc.buftype != '' || doc.schema != 'file') {
            nvim.errWriteLine('current buffer is not file.');
            return;
        }
        let oldPath = vscode_uri_1.URI.parse(doc.uri).fsPath;
        // await nvim.callAsync()
        let newPath = await nvim.callAsync('coc#util#with_callback', ['input', ['New path: ', oldPath, 'file']]);
        newPath = newPath ? newPath.trim() : null;
        if (newPath == oldPath || !newPath)
            return;
        let lines = await doc.buffer.lines;
        let exists = fs_1.default.existsSync(oldPath);
        if (exists) {
            let modified = await nvim.eval('&modified');
            if (modified)
                await nvim.command('noa w');
            if (oldPath.toLowerCase() != newPath.toLowerCase() && fs_1.default.existsSync(newPath)) {
                let overwrite = await this.showPrompt(`${newPath} exists, overwrite?`);
                if (!overwrite)
                    return;
                fs_1.default.unlinkSync(newPath);
            }
            fs_1.default.renameSync(oldPath, newPath);
        }
        let filepath = fs_2.isParentFolder(cwd, newPath) ? path_1.default.relative(cwd, newPath) : newPath;
        let view = await nvim.call('winsaveview');
        nvim.pauseNotification();
        if (oldPath.toLowerCase() == newPath.toLowerCase()) {
            nvim.command(`keepalt ${bufnr}bwipeout!`, true);
            nvim.call('coc#util#open_file', ['keepalt edit', filepath], true);
        }
        else {
            nvim.call('coc#util#open_file', ['keepalt edit', filepath], true);
            nvim.command(`${bufnr}bwipeout!`, true);
        }
        if (!exists && lines.join('\n') != '\n') {
            nvim.call('append', [0, lines], true);
            nvim.command('normal! Gdd', true);
        }
        nvim.call('winrestview', [view], true);
        await nvim.resumeNotification();
    }
    setMessageLevel() {
        let config = this.getConfiguration('coc.preferences');
        let level = config.get('messageLevel', 'more');
        switch (level) {
            case 'error':
                this.messageLevel = types_1.MessageLevel.Error;
                break;
            case 'warning':
                this.messageLevel = types_1.MessageLevel.Warning;
                break;
            default:
                this.messageLevel = types_1.MessageLevel.More;
        }
    }
    get folderPaths() {
        return this.workspaceFolders.map(f => vscode_uri_1.URI.parse(f.uri).fsPath);
    }
    get floatSupported() {
        let { env } = this;
        return env.floating || env.textprop;
    }
    removeWorkspaceFolder(fsPath) {
        let idx = this._workspaceFolders.findIndex(f => vscode_uri_1.URI.parse(f.uri).fsPath == fsPath);
        if (idx != -1) {
            let folder = this._workspaceFolders[idx];
            this._workspaceFolders.splice(idx, 1);
            this._onDidChangeWorkspaceFolders.fire({
                removed: [folder],
                added: []
            });
        }
    }
    renameWorkspaceFolder(oldPath, newPath) {
        let idx = this._workspaceFolders.findIndex(f => vscode_uri_1.URI.parse(f.uri).fsPath == oldPath);
        if (idx == -1)
            return;
        let removed = this._workspaceFolders[idx];
        let added = {
            uri: vscode_uri_1.URI.file(newPath).toString(),
            name: path_1.default.dirname(newPath)
        };
        this._workspaceFolders.splice(idx, 1);
        this._workspaceFolders.push(added);
        this._onDidChangeWorkspaceFolders.fire({
            removed: [removed],
            added: [added]
        });
    }
    addRootPattern(filetype, rootPatterns) {
        let patterns = this.rootPatterns.get(filetype) || [];
        for (let p of rootPatterns) {
            if (!patterns.includes(p)) {
                patterns.push(p);
            }
        }
        this.rootPatterns.set(filetype, patterns);
    }
    get insertMode() {
        return this._insertMode;
    }
    addWorkspaceFolder(rootPath) {
        if (rootPath == os_1.default.homedir())
            return;
        let { _workspaceFolders } = this;
        let uri = vscode_uri_1.URI.file(rootPath).toString();
        let workspaceFolder = { uri, name: path_1.default.basename(rootPath) };
        if (_workspaceFolders.findIndex(o => o.uri == uri) == -1) {
            _workspaceFolders.push(workspaceFolder);
            if (this._initialized) {
                this._onDidChangeWorkspaceFolders.fire({
                    added: [workspaceFolder],
                    removed: []
                });
            }
        }
        return workspaceFolder;
    }
    getServerRootPatterns(filetype) {
        let lspConfig = this.getConfiguration().get('languageserver', {});
        let patterns = [];
        for (let key of Object.keys(lspConfig)) {
            let config = lspConfig[key];
            let { filetypes, rootPatterns } = config;
            if (filetypes && rootPatterns && filetypes.includes(filetype)) {
                patterns.push(...rootPatterns);
            }
        }
        patterns = patterns.concat(this.rootPatterns.get(filetype) || []);
        return patterns.length ? array_1.distinct(patterns) : null;
    }
}
exports.Workspace = Workspace;
exports.default = new Workspace();
//# sourceMappingURL=workspace.js.map