"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiagnosticManager = void 0;
const tslib_1 = require("tslib");
const debounce_1 = tslib_1.__importDefault(require("debounce"));
const semver_1 = tslib_1.__importDefault(require("semver"));
const vscode_languageserver_protocol_1 = require("vscode-languageserver-protocol");
const vscode_uri_1 = require("vscode-uri");
const events_1 = tslib_1.__importDefault(require("../events"));
const floatFactory_1 = tslib_1.__importDefault(require("../model/floatFactory"));
const util_1 = require("../util");
const position_1 = require("../util/position");
const workspace_1 = tslib_1.__importDefault(require("../workspace"));
const buffer_1 = require("./buffer");
const collection_1 = tslib_1.__importDefault(require("./collection"));
const util_2 = require("./util");
const logger = require('../util/logger')('diagnostic-manager');
class DiagnosticManager {
    constructor() {
        this.enabled = true;
        this.buffers = new Map();
        this.lastMessage = '';
        this.collections = [];
        this.disposables = [];
    }
    init() {
        this.setConfiguration();
        let { nvim } = workspace_1.default;
        let { maxWindowHeight, maxWindowWidth } = this.config;
        this.floatFactory = new floatFactory_1.default(nvim, workspace_1.default.env, false, maxWindowHeight, maxWindowWidth);
        this.disposables.push(vscode_languageserver_protocol_1.Disposable.create(() => {
            if (this.timer)
                clearTimeout(this.timer);
        }));
        events_1.default.on('CursorMoved', () => {
            if (this.config.enableMessage != 'always')
                return;
            if (this.timer)
                clearTimeout(this.timer);
            this.timer = setTimeout(async () => {
                await this.echoMessage(true);
            }, this.config.messageDelay);
        }, null, this.disposables);
        let fn = debounce_1.default((bufnr, cursor) => {
            if (!this.config.virtualText || !this.config.virtualTextCurrentLineOnly) {
                return;
            }
            let buf = this.buffers.get(bufnr);
            if (buf) {
                let diagnostics = this.getDiagnostics(buf.uri);
                buf.showVirtualText(diagnostics, cursor[0]);
            }
        }, 100);
        events_1.default.on('CursorMoved', fn, null, this.disposables);
        this.disposables.push(vscode_languageserver_protocol_1.Disposable.create(() => {
            fn.clear();
        }));
        events_1.default.on('InsertEnter', () => {
            if (this.timer)
                clearTimeout(this.timer);
            this.floatFactory.close();
        }, null, this.disposables);
        events_1.default.on('InsertLeave', async (bufnr) => {
            this.floatFactory.close();
            if (!this.buffers.has(bufnr))
                return;
            let doc = workspace_1.default.getDocument(bufnr);
            if (!doc)
                return;
            doc.forceSync();
            let { refreshOnInsertMode, refreshAfterSave } = this.config;
            if (!refreshOnInsertMode && !refreshAfterSave) {
                this.refreshBuffer(doc.uri);
            }
        }, null, this.disposables);
        events_1.default.on('BufEnter', async () => {
            if (this.timer)
                clearTimeout(this.timer);
        }, null, this.disposables);
        events_1.default.on('BufWritePost', async (bufnr) => {
            let buf = this.buffers.get(bufnr);
            if (!buf)
                return;
            await buf.checkSigns();
            if (!this.config.refreshAfterSave)
                return;
            this.refreshBuffer(buf.uri);
        }, null, this.disposables);
        workspace_1.default.onDidChangeConfiguration(e => {
            this.setConfiguration(e);
        }, null, this.disposables);
        // create buffers
        for (let doc of workspace_1.default.documents) {
            this.createDiagnosticBuffer(doc);
        }
        workspace_1.default.onDidOpenTextDocument(textDocument => {
            let doc = workspace_1.default.getDocument(textDocument.uri);
            this.createDiagnosticBuffer(doc);
        }, null, this.disposables);
        workspace_1.default.onDidCloseTextDocument(({ uri }) => {
            let doc = workspace_1.default.getDocument(uri);
            if (!doc)
                return;
            this.disposeBuffer(doc.bufnr);
        }, null, this.disposables);
        this.setConfigurationErrors(true);
        workspace_1.default.configurations.onError(() => {
            this.setConfigurationErrors();
        }, null, this.disposables);
        let { enableHighlightLineNumber } = this.config;
        if (!workspace_1.default.isNvim || semver_1.default.lt(workspace_1.default.env.version, 'v0.3.2')) {
            enableHighlightLineNumber = false;
        }
        nvim.pauseNotification();
        if (this.config.enableSign) {
            for (let kind of ['Error', 'Warning', 'Info', 'Hint']) {
                let signText = this.config[kind.toLowerCase() + 'Sign'];
                let cmd = `sign define Coc${kind} linehl=Coc${kind}Line`;
                if (signText)
                    cmd += ` texthl=Coc${kind}Sign text=${signText}`;
                if (enableHighlightLineNumber)
                    cmd += ` numhl=Coc${kind}Sign`;
                nvim.command(cmd, true);
            }
        }
        nvim.resumeNotification(false, true).logError();
    }
    createDiagnosticBuffer(doc) {
        if (!this.shouldValidate(doc))
            return;
        let { bufnr } = doc;
        let buf = this.buffers.get(bufnr);
        if (buf)
            return;
        buf = new buffer_1.DiagnosticBuffer(bufnr, doc.uri, this.config);
        this.buffers.set(bufnr, buf);
        buf.onDidRefresh(() => {
            if (['never', 'jump'].includes(this.config.enableMessage)) {
                return;
            }
            this.echoMessage(true).logError();
        });
    }
    async setLocationlist(bufnr) {
        let buf = this.buffers.get(bufnr);
        let diagnostics = buf ? this.getDiagnostics(buf.uri) : [];
        let items = [];
        for (let diagnostic of diagnostics) {
            let item = util_2.getLocationListItem(bufnr, diagnostic);
            items.push(item);
        }
        let curr = await this.nvim.call('getloclist', [0, { title: 1 }]);
        let action = curr.title && curr.title.indexOf('Diagnostics of coc') != -1 ? 'r' : ' ';
        await this.nvim.call('setloclist', [0, [], action, { title: 'Diagnostics of coc', items }]);
    }
    setConfigurationErrors(init) {
        let collections = this.collections;
        let collection = collections.find(o => o.name == 'config');
        if (!collection) {
            collection = this.create('config');
        }
        else {
            collection.clear();
        }
        let { errorItems } = workspace_1.default.configurations;
        if (errorItems && errorItems.length) {
            if (init)
                workspace_1.default.showMessage(`settings file parse error, run ':CocList diagnostics'`, 'error');
            let entries = new Map();
            for (let item of errorItems) {
                let { uri } = item.location;
                let diagnostics = entries.get(uri) || [];
                diagnostics.push(vscode_languageserver_protocol_1.Diagnostic.create(item.location.range, item.message, vscode_languageserver_protocol_1.DiagnosticSeverity.Error));
                entries.set(uri, diagnostics);
            }
            collection.set(Array.from(entries));
        }
    }
    /**
     * Create collection by name
     */
    create(name) {
        let collection = new collection_1.default(name);
        this.collections.push(collection);
        // Used for refresh diagnostics on buferEnter when refreshAfterSave is true
        // Note we can't make sure it work as expected when there're multiple sources
        let createTime = Date.now();
        let refreshed = false;
        collection.onDidDiagnosticsChange(uri => {
            if (this.config.refreshAfterSave &&
                (refreshed || Date.now() - createTime > 5000))
                return;
            refreshed = true;
            this.refreshBuffer(uri);
        });
        collection.onDidDiagnosticsClear(uris => {
            for (let uri of uris) {
                this.refreshBuffer(uri, true);
            }
        });
        collection.onDispose(() => {
            let idx = this.collections.findIndex(o => o == collection);
            if (idx !== -1)
                this.collections.splice(idx, 1);
        });
        return collection;
    }
    /**
     * Get diagnostics ranges from document
     */
    getSortedRanges(uri, severity) {
        let collections = this.getCollections(uri);
        let res = [];
        let level = severity ? util_2.severityLevel(severity) : 0;
        for (let collection of collections) {
            let diagnostics = collection.get(uri);
            if (level)
                diagnostics = diagnostics.filter(o => o.severity == level);
            let ranges = diagnostics.map(o => o.range);
            res.push(...ranges);
        }
        res.sort((a, b) => {
            if (a.start.line != b.start.line) {
                return a.start.line - b.start.line;
            }
            return a.start.character - b.start.character;
        });
        return res;
    }
    /**
     * Get readonly diagnostics for a buffer
     */
    getDiagnostics(uri) {
        let collections = this.getCollections(uri);
        let { level } = this.config;
        let res = [];
        for (let collection of collections) {
            let items = collection.get(uri);
            if (!items)
                continue;
            if (level && level < vscode_languageserver_protocol_1.DiagnosticSeverity.Hint) {
                items = items.filter(s => s.severity == null || s.severity <= level);
            }
            res.push(...items);
        }
        res.sort((a, b) => {
            if (a.severity == b.severity) {
                let d = position_1.comparePosition(a.range.start, b.range.start);
                if (d != 0)
                    return d;
                if (a.source == b.source)
                    return a.message > b.message ? 1 : -1;
                return a.source > b.source ? 1 : -1;
            }
            return a.severity - b.severity;
        });
        return res;
    }
    getDiagnosticsInRange(document, range) {
        let collections = this.getCollections(document.uri);
        let res = [];
        for (let collection of collections) {
            let items = collection.get(document.uri);
            if (!items)
                continue;
            for (let item of items) {
                if (position_1.rangeIntersect(item.range, range)) {
                    res.push(item);
                }
            }
        }
        return res;
    }
    /**
     * Show diagnostics under curosr in preview window
     */
    async preview() {
        let [bufnr, cursor] = await this.nvim.eval('[bufnr("%"),coc#util#cursor()]');
        let { nvim } = this;
        let diagnostics = this.getDiagnosticsAt(bufnr, cursor);
        if (diagnostics.length == 0) {
            nvim.command('pclose', true);
            workspace_1.default.showMessage(`Empty diagnostics`, 'warning');
            return;
        }
        let lines = [];
        for (let diagnostic of diagnostics) {
            let { source, code, severity, message } = diagnostic;
            let s = util_2.getSeverityName(severity)[0];
            lines.push(`[${source}${code ? ' ' + code : ''}] [${s}]`);
            lines.push(...message.split(/\r?\n/));
            lines.push('');
        }
        lines = lines.slice(0, -1);
        // let content = lines.join('\n').trim()
        nvim.call('coc#util#preview_info', [lines, 'txt'], true);
    }
    /**
     * Jump to previous diagnostic position
     */
    async jumpPrevious(severity) {
        let buffer = await this.nvim.buffer;
        let document = workspace_1.default.getDocument(buffer.id);
        if (!document)
            return;
        let offset = await workspace_1.default.getOffset();
        if (offset == null)
            return;
        let ranges = this.getSortedRanges(document.uri, severity);
        if (ranges.length == 0) {
            workspace_1.default.showMessage('Empty diagnostics', 'warning');
            return;
        }
        let { textDocument } = document;
        let pos;
        for (let i = ranges.length - 1; i >= 0; i--) {
            if (textDocument.offsetAt(ranges[i].end) < offset) {
                pos = ranges[i].start;
                break;
            }
            else if (i == 0) {
                let wrapscan = await this.nvim.getOption('wrapscan');
                if (wrapscan)
                    pos = ranges[ranges.length - 1].start;
            }
        }
        if (pos) {
            await workspace_1.default.moveTo(pos);
            if (this.config.enableMessage == 'never')
                return;
            await this.echoMessage(false);
        }
    }
    /**
     * Jump to next diagnostic position
     */
    async jumpNext(severity) {
        let buffer = await this.nvim.buffer;
        let document = workspace_1.default.getDocument(buffer.id);
        let offset = await workspace_1.default.getOffset();
        let ranges = this.getSortedRanges(document.uri, severity);
        if (ranges.length == 0) {
            workspace_1.default.showMessage('Empty diagnostics', 'warning');
            return;
        }
        let { textDocument } = document;
        let pos;
        for (let i = 0; i <= ranges.length - 1; i++) {
            if (textDocument.offsetAt(ranges[i].start) > offset) {
                pos = ranges[i].start;
                break;
            }
            else if (i == ranges.length - 1) {
                let wrapscan = await this.nvim.getOption('wrapscan');
                if (wrapscan)
                    pos = ranges[0].start;
            }
        }
        if (pos) {
            await workspace_1.default.moveTo(pos);
            if (this.config.enableMessage == 'never')
                return;
            await this.echoMessage(false);
        }
    }
    /**
     * All diagnostics of current workspace
     */
    getDiagnosticList() {
        let res = [];
        for (let collection of this.collections) {
            collection.forEach((uri, diagnostics) => {
                let file = vscode_uri_1.URI.parse(uri).fsPath;
                for (let diagnostic of diagnostics) {
                    let { start } = diagnostic.range;
                    let o = {
                        file,
                        lnum: start.line + 1,
                        col: start.character + 1,
                        message: `[${diagnostic.source || collection.name}${diagnostic.code ? ' ' + diagnostic.code : ''}] ${diagnostic.message}`,
                        severity: util_2.getSeverityName(diagnostic.severity),
                        level: diagnostic.severity || 0,
                        location: vscode_languageserver_protocol_1.Location.create(uri, diagnostic.range)
                    };
                    res.push(o);
                }
            });
        }
        res.sort((a, b) => {
            if (a.level !== b.level) {
                return a.level - b.level;
            }
            if (a.file !== b.file) {
                return a.file > b.file ? 1 : -1;
            }
            else {
                if (a.lnum != b.lnum) {
                    return a.lnum - b.lnum;
                }
                return a.col - b.col;
            }
        });
        return res;
    }
    getDiagnosticsAt(bufnr, cursor) {
        let pos = vscode_languageserver_protocol_1.Position.create(cursor[0], cursor[1]);
        let buffer = this.buffers.get(bufnr);
        if (!buffer)
            return [];
        let diagnostics = this.getDiagnostics(buffer.uri);
        let { checkCurrentLine } = this.config;
        if (checkCurrentLine) {
            diagnostics = diagnostics.filter(o => position_1.lineInRange(pos.line, o.range));
        }
        else {
            diagnostics = diagnostics.filter(o => position_1.positionInRange(pos, o.range) == 0);
        }
        diagnostics.sort((a, b) => a.severity - b.severity);
        return diagnostics;
    }
    async getCurrentDiagnostics() {
        let [bufnr, cursor] = await this.nvim.eval('[bufnr("%"),coc#util#cursor()]');
        return this.getDiagnosticsAt(bufnr, cursor);
    }
    /**
     * Echo diagnostic message of currrent position
     */
    async echoMessage(truncate = false) {
        const config = this.config;
        if (!this.enabled)
            return;
        if (this.timer)
            clearTimeout(this.timer);
        let useFloat = config.messageTarget == 'float';
        let [bufnr, cursor, filetype, mode, disabled, isFloat] = await this.nvim.eval('[bufnr("%"),coc#util#cursor(),&filetype,mode(),get(b:,"coc_diagnostic_disable",0),get(w:,"float",0)]');
        if (mode != 'n' || isFloat == 1 || disabled)
            return;
        let diagnostics = this.getDiagnosticsAt(bufnr, cursor);
        if (diagnostics.length == 0) {
            if (useFloat) {
                this.floatFactory.close();
            }
            else {
                let echoLine = await this.nvim.call('coc#util#echo_line');
                if (this.lastMessage && echoLine.startsWith(this.lastMessage)) {
                    this.nvim.command('echo ""', true);
                }
            }
            return;
        }
        if (truncate && workspace_1.default.insertMode)
            return;
        let docs = [];
        let ft = '';
        if (Object.keys(config.filetypeMap).length > 0) {
            const defaultFiletype = config.filetypeMap['default'] || '';
            ft = config.filetypeMap[filetype] || (defaultFiletype == 'bufferType' ? filetype : defaultFiletype);
        }
        diagnostics.forEach(diagnostic => {
            let { source, code, severity, message } = diagnostic;
            let s = util_2.getSeverityName(severity)[0];
            const codeStr = code ? ' ' + code : '';
            const str = config.format.replace('%source', source).replace('%code', codeStr).replace('%severity', s).replace('%message', message);
            let filetype = 'Error';
            if (ft === '') {
                switch (severity) {
                    case vscode_languageserver_protocol_1.DiagnosticSeverity.Hint:
                        filetype = 'Hint';
                        break;
                    case vscode_languageserver_protocol_1.DiagnosticSeverity.Warning:
                        filetype = 'Warning';
                        break;
                    case vscode_languageserver_protocol_1.DiagnosticSeverity.Information:
                        filetype = 'Info';
                        break;
                }
            }
            else {
                filetype = ft;
            }
            docs.push({ filetype, content: str });
        });
        if (useFloat) {
            await this.floatFactory.create(docs);
        }
        else {
            let lines = docs.map(d => d.content).join('\n').split(/\r?\n/);
            if (lines.length) {
                await this.nvim.command('echo ""');
                this.lastMessage = lines[0].slice(0, 30);
                await workspace_1.default.echoLines(lines, truncate);
            }
        }
    }
    async jumpRelated() {
        let diagnostics = await this.getCurrentDiagnostics();
        if (!diagnostics)
            return;
        let diagnostic = diagnostics.find(o => o.relatedInformation != null);
        if (!diagnostic)
            return;
        let locations = diagnostic.relatedInformation.map(o => o.location);
        if (locations.length == 1) {
            await workspace_1.default.jumpTo(locations[0].uri, locations[0].range.start);
        }
        else if (locations.length > 1) {
            await workspace_1.default.showLocations(locations);
        }
    }
    disposeBuffer(bufnr) {
        let buf = this.buffers.get(bufnr);
        if (!buf)
            return;
        buf.clear().logError();
        buf.dispose();
        this.buffers.delete(bufnr);
        for (let collection of this.collections) {
            collection.delete(buf.uri);
        }
    }
    hideFloat() {
        if (this.floatFactory) {
            this.floatFactory.close();
        }
    }
    dispose() {
        for (let buf of this.buffers.values()) {
            buf.clear().logError();
            buf.dispose();
        }
        for (let collection of this.collections) {
            collection.dispose();
        }
        this.hideFloat();
        this.buffers.clear();
        this.collections = [];
        util_1.disposeAll(this.disposables);
    }
    get nvim() {
        return workspace_1.default.nvim;
    }
    setConfiguration(event) {
        if (event && !event.affectsConfiguration('diagnostic'))
            return;
        let config = workspace_1.default.getConfiguration('diagnostic');
        let messageTarget = config.get('messageTarget', 'float');
        if (messageTarget == 'float' && !workspace_1.default.env.floating && !workspace_1.default.env.textprop) {
            messageTarget = 'echo';
        }
        this.config = {
            messageTarget,
            srcId: workspace_1.default.createNameSpace('coc-diagnostic') || 1000,
            virtualTextSrcId: workspace_1.default.createNameSpace('diagnostic-virtualText'),
            checkCurrentLine: config.get('checkCurrentLine', false),
            enableSign: config.get('enableSign', true),
            locationlistUpdate: config.get('locationlistUpdate', true),
            enableHighlightLineNumber: config.get('enableHighlightLineNumber', true),
            maxWindowHeight: config.get('maxWindowHeight', 10),
            maxWindowWidth: config.get('maxWindowWidth', 80),
            enableMessage: config.get('enableMessage', 'always'),
            messageDelay: config.get('messageDelay', 200),
            virtualText: config.get('virtualText', false) && this.nvim.hasFunction('nvim_buf_set_virtual_text'),
            virtualTextCurrentLineOnly: config.get('virtualTextCurrentLineOnly', true),
            virtualTextPrefix: config.get('virtualTextPrefix', " "),
            virtualTextLineSeparator: config.get('virtualTextLineSeparator', " \\ "),
            virtualTextLines: config.get('virtualTextLines', 3),
            displayByAle: config.get('displayByAle', false),
            level: util_2.severityLevel(config.get('level', 'hint')),
            signOffset: config.get('signOffset', 1000),
            errorSign: config.get('errorSign', '>>'),
            warningSign: config.get('warningSign', '>>'),
            infoSign: config.get('infoSign', '>>'),
            hintSign: config.get('hintSign', '>>'),
            refreshAfterSave: config.get('refreshAfterSave', false),
            refreshOnInsertMode: config.get('refreshOnInsertMode', false),
            filetypeMap: config.get('filetypeMap', {}),
            format: config.get('format', '[%source%code] [%severity] %message')
        };
        this.enabled = config.get('enable', true);
        if (this.config.displayByAle) {
            this.enabled = false;
        }
        if (event) {
            for (let severity of ['error', 'info', 'warning', 'hint']) {
                let key = `diagnostic.${severity}Sign`;
                if (event.affectsConfiguration(key)) {
                    let text = config.get(`${severity}Sign`, '>>');
                    let name = severity[0].toUpperCase() + severity.slice(1);
                    this.nvim.command(`sign define Coc${name}   text=${text}   linehl=Coc${name}Line texthl=Coc${name}Sign`, true);
                }
            }
        }
    }
    getCollections(uri) {
        return this.collections.filter(c => c.has(uri));
    }
    shouldValidate(doc) {
        return doc != null && doc.buftype == '' && doc.attached;
    }
    clearDiagnostic(bufnr) {
        let buf = this.buffers.get(bufnr);
        if (!buf)
            return;
        for (let collection of this.collections) {
            collection.delete(buf.uri);
        }
        buf.clear().logError();
    }
    toggleDiagnostic() {
        let { enabled } = this;
        this.enabled = !enabled;
        for (let buf of this.buffers.values()) {
            if (this.enabled) {
                let diagnostics = this.getDiagnostics(buf.uri);
                buf.forceRefresh(diagnostics);
            }
            else {
                buf.clear().logError();
            }
        }
    }
    refreshBuffer(uri, force = false) {
        let buf = Array.from(this.buffers.values()).find(o => o.uri == uri);
        if (!buf)
            return false;
        let { displayByAle, refreshOnInsertMode } = this.config;
        if (!displayByAle) {
            if (!refreshOnInsertMode && workspace_1.default.insertMode)
                return false;
            let diagnostics = this.getDiagnostics(uri);
            if (this.enabled) {
                if (force) {
                    buf.forceRefresh(diagnostics);
                }
                else {
                    buf.refresh(diagnostics);
                }
                return true;
            }
        }
        else {
            let { nvim } = this;
            nvim.pauseNotification();
            for (let collection of this.collections) {
                let diagnostics = collection.get(uri);
                const { level } = this.config;
                if (level) {
                    diagnostics = diagnostics.filter(o => o.severity && o.severity <= level);
                }
                let aleItems = diagnostics.map(o => {
                    let { range } = o;
                    return {
                        text: o.message,
                        code: o.code,
                        lnum: range.start.line + 1,
                        col: range.start.character + 1,
                        end_lnum: range.end.line + 1,
                        end_col: range.end.character,
                        type: util_2.getSeverityType(o.severity)
                    };
                });
                nvim.call('ale#other_source#ShowResults', [buf.bufnr, collection.name, aleItems], true);
            }
            nvim.resumeNotification(false, true).logError();
        }
        return false;
    }
}
exports.DiagnosticManager = DiagnosticManager;
exports.default = new DiagnosticManager();
//# sourceMappingURL=manager.js.map