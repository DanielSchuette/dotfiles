"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListManager = void 0;
const tslib_1 = require("tslib");
const debounce_1 = tslib_1.__importDefault(require("debounce"));
const vscode_languageserver_protocol_1 = require("vscode-languageserver-protocol");
const events_1 = tslib_1.__importDefault(require("../events"));
const extensions_1 = tslib_1.__importDefault(require("../extensions"));
const util_1 = require("../util");
const workspace_1 = tslib_1.__importDefault(require("../workspace"));
const configuration_1 = tslib_1.__importDefault(require("./configuration"));
const mappings_1 = tslib_1.__importDefault(require("./mappings"));
const prompt_1 = tslib_1.__importDefault(require("./prompt"));
const session_1 = tslib_1.__importDefault(require("./session"));
const commands_1 = tslib_1.__importDefault(require("./source/commands"));
const diagnostics_1 = tslib_1.__importDefault(require("./source/diagnostics"));
const extensions_2 = tslib_1.__importDefault(require("./source/extensions"));
const folders_1 = tslib_1.__importDefault(require("./source/folders"));
const links_1 = tslib_1.__importDefault(require("./source/links"));
const lists_1 = tslib_1.__importDefault(require("./source/lists"));
const location_1 = tslib_1.__importDefault(require("./source/location"));
const outline_1 = tslib_1.__importDefault(require("./source/outline"));
const services_1 = tslib_1.__importDefault(require("./source/services"));
const sources_1 = tslib_1.__importDefault(require("./source/sources"));
const symbols_1 = tslib_1.__importDefault(require("./source/symbols"));
const logger = require('../util/logger')('list-manager');
const mouseKeys = ['<LeftMouse>', '<LeftDrag>', '<LeftRelease>', '<2-LeftMouse>'];
class ListManager {
    constructor() {
        this.plugTs = 0;
        this.sessionsMap = new Map();
        this.disposables = [];
        this.listMap = new Map();
    }
    init(nvim) {
        this.nvim = nvim;
        this.config = new configuration_1.default();
        this.prompt = new prompt_1.default(nvim, this.config);
        this.mappings = new mappings_1.default(this, nvim, this.config);
        let signText = this.config.get('selectedSignText', '*');
        nvim.command(`sign define CocSelected text=${signText} texthl=CocSelectedText linehl=CocSelectedLine`, true);
        events_1.default.on('InputChar', this.onInputChar, this, this.disposables);
        events_1.default.on('FocusGained', debounce_1.default(async () => {
            let session = await this.getCurrentSession();
            if (session)
                this.prompt.drawPrompt();
        }, 100), null, this.disposables);
        let timer;
        events_1.default.on('WinEnter', winid => {
            if (timer)
                clearTimeout(timer);
            timer = setTimeout(() => {
                let session = this.getSessionByWinid(winid);
                if (session)
                    this.prompt.start(session.listOptions);
            }, 100);
        }, null, this.disposables);
        this.disposables.push(vscode_languageserver_protocol_1.Disposable.create(() => {
            if (timer)
                clearTimeout(timer);
        }));
        // filter history on input
        this.prompt.onDidChangeInput(() => {
            let { session } = this;
            if (!session)
                return;
            session.onInputChange();
            session.history.filter();
        });
        this.registerList(new links_1.default(nvim));
        this.registerList(new location_1.default(nvim));
        this.registerList(new symbols_1.default(nvim));
        this.registerList(new outline_1.default(nvim));
        this.registerList(new commands_1.default(nvim));
        this.registerList(new extensions_2.default(nvim));
        this.registerList(new diagnostics_1.default(nvim));
        this.registerList(new sources_1.default(nvim));
        this.registerList(new services_1.default(nvim));
        this.registerList(new lists_1.default(nvim, this.listMap));
        this.registerList(new folders_1.default(nvim));
    }
    async start(args) {
        this.getCharMap().logError();
        let res = this.parseArgs(args);
        if (!res)
            return;
        let { name } = res.list;
        let curr = this.sessionsMap.get(name);
        if (curr) {
            this.nvim.command('pclose', true);
            curr.dispose();
        }
        this.prompt.start(res.options);
        let session = new session_1.default(this.nvim, this.prompt, res.list, res.options, res.listArgs, this.config);
        this.sessionsMap.set(name, session);
        this.lastSession = session;
        try {
            await session.start(args);
        }
        catch (e) {
            this.nvim.call('coc#list#stop_prompt', [], true);
            let msg = e instanceof Error ? e.message : e.toString();
            workspace_1.default.showMessage(`Error on "CocList ${name}": ${msg}`, 'error');
            logger.error(e);
        }
    }
    getSessionByWinid(winid) {
        for (let session of this.sessionsMap.values()) {
            if (session && session.winid == winid) {
                this.lastSession = session;
                return session;
            }
        }
        return null;
    }
    async getCurrentSession() {
        let { id } = await this.nvim.window;
        for (let session of this.sessionsMap.values()) {
            if (session && session.winid == id) {
                this.lastSession = session;
                return session;
            }
        }
        return null;
    }
    async resume(name) {
        var _a;
        if (!name) {
            await ((_a = this.session) === null || _a === void 0 ? void 0 : _a.resume());
        }
        else {
            let session = this.sessionsMap.get(name);
            if (!session) {
                workspace_1.default.showMessage(`Can't find exists ${name} list`);
                return;
            }
            await session.resume();
        }
    }
    async doAction(name) {
        let lastSession = this.lastSession;
        if (!lastSession)
            return;
        await lastSession.doAction(name);
    }
    async first(name) {
        let s = this.getSession(name);
        if (s)
            await s.first();
    }
    async last(name) {
        let s = this.getSession(name);
        if (s)
            await s.last();
    }
    async previous(name) {
        let s = this.getSession(name);
        if (s)
            await s.previous();
    }
    async next(name) {
        let s = this.getSession(name);
        if (s)
            await s.next();
    }
    getSession(name) {
        if (!name)
            return this.session;
        return this.sessionsMap.get(name);
    }
    async cancel(close = true) {
        this.prompt.cancel();
        if (!close)
            return;
        if (this.session)
            await this.session.hide();
    }
    /**
     * Clear all list sessions
     */
    async reset() {
        this.prompt.cancel();
        this.lastSession = undefined;
        for (let session of this.sessionsMap.values()) {
            await session.hide();
            session.dispose();
        }
        this.sessionsMap.clear();
    }
    switchMatcher() {
        var _a;
        (_a = this.session) === null || _a === void 0 ? void 0 : _a.switchMatcher();
    }
    async togglePreview() {
        let { nvim } = this;
        let has = await nvim.call('coc#list#has_preview');
        if (has) {
            await nvim.command('pclose');
            await nvim.command('redraw');
        }
        else {
            await this.doAction('preview');
        }
    }
    async chooseAction() {
        let { lastSession } = this;
        if (lastSession)
            await lastSession.chooseAction();
    }
    parseArgs(args) {
        let options = [];
        let interactive = false;
        let autoPreview = false;
        let numberSelect = false;
        let noQuit = false;
        let first = false;
        let name;
        let input = '';
        let matcher = 'fuzzy';
        let position = 'bottom';
        let listArgs = [];
        let listOptions = [];
        for (let arg of args) {
            if (!name && arg.startsWith('-')) {
                listOptions.push(arg);
            }
            else if (!name) {
                if (!/^\w+$/.test(arg)) {
                    workspace_1.default.showMessage(`Invalid list option: "${arg}"`, 'error');
                    return null;
                }
                name = arg;
            }
            else {
                listArgs.push(arg);
            }
        }
        name = name || 'lists';
        let config = workspace_1.default.getConfiguration(`list.source.${name}`);
        if (!listOptions.length && !listArgs.length)
            listOptions = config.get('defaultOptions', []);
        if (!listArgs.length)
            listArgs = config.get('defaultArgs', []);
        for (let opt of listOptions) {
            if (opt.startsWith('--input')) {
                input = opt.slice(8);
            }
            else if (opt == '--number-select' || opt == '-N') {
                numberSelect = true;
            }
            else if (opt == '--auto-preview' || opt == '-A') {
                autoPreview = true;
            }
            else if (opt == '--regex' || opt == '-R') {
                matcher = 'regex';
            }
            else if (opt == '--strict' || opt == '-S') {
                matcher = 'strict';
            }
            else if (opt == '--interactive' || opt == '-I') {
                interactive = true;
            }
            else if (opt == '--top') {
                position = 'top';
            }
            else if (opt == '--tab') {
                position = 'tab';
            }
            else if (opt == '--ignore-case' || opt == '--normal' || opt == '--no-sort') {
                options.push(opt.slice(2));
            }
            else if (opt == '--first') {
                first = true;
            }
            else if (opt == '--no-quit') {
                noQuit = true;
            }
            else {
                workspace_1.default.showMessage(`Invalid option "${opt}" of list`, 'error');
                return null;
            }
        }
        let list = this.listMap.get(name);
        if (!list) {
            workspace_1.default.showMessage(`List ${name} not found`, 'error');
            return null;
        }
        if (interactive && !list.interactive) {
            workspace_1.default.showMessage(`Interactive mode of "${name}" list not supported`, 'error');
            return null;
        }
        return {
            list,
            listArgs,
            options: {
                numberSelect,
                autoPreview,
                noQuit,
                first,
                input,
                interactive,
                matcher,
                position,
                ignorecase: options.includes('ignore-case') ? true : false,
                mode: !options.includes('normal') ? 'insert' : 'normal',
                sort: !options.includes('no-sort') ? true : false
            },
        };
    }
    async onInputChar(ch, charmod) {
        let { mode } = this.prompt;
        if (!this.lastSession || !this.lastSession.winid)
            return;
        let mapped = this.charMap.get(ch);
        let now = Date.now();
        if (mapped == '<plug>' || now - this.plugTs < 2) {
            this.plugTs = now;
            return;
        }
        if (!ch)
            return;
        if (ch == '\x1b') {
            await this.cancel();
            return;
        }
        try {
            if (mode == 'insert') {
                await this.onInsertInput(ch, charmod);
            }
            else {
                await this.onNormalInput(ch, charmod);
            }
        }
        catch (e) {
            workspace_1.default.showMessage(`Error on input ${ch}: ${e}`);
            logger.error(e);
        }
    }
    async onInsertInput(ch, charmod) {
        let { session } = this;
        if (!session)
            return;
        let inserted = this.charMap.get(ch) || ch;
        if (mouseKeys.includes(inserted)) {
            await this.onMouseEvent(inserted);
            return;
        }
        let n = await session.doNumberSelect(ch);
        if (n)
            return;
        let done = await this.mappings.doInsertKeymap(inserted);
        if (done || charmod || this.charMap.has(ch))
            return;
        for (let s of ch) {
            let code = s.codePointAt(0);
            if (code == 65533)
                return;
            // exclude control character
            if (code < 32 || code >= 127 && code <= 159)
                return;
            await this.prompt.acceptCharacter(s);
        }
    }
    async onNormalInput(ch, _charmod) {
        let inserted = this.charMap.get(ch) || ch;
        if (mouseKeys.includes(inserted)) {
            await this.onMouseEvent(inserted);
            return;
        }
        let done = await this.mappings.doNormalKeymap(inserted);
        if (!done)
            await this.feedkeys(inserted);
    }
    onMouseEvent(key) {
        if (this.session)
            return this.session.onMouseEvent(key);
    }
    async feedkeys(key, remap = true) {
        let { nvim } = this;
        key = key.startsWith('<') && key.endsWith('>') ? `\\${key}` : key;
        await nvim.call('coc#list#stop_prompt', [1]);
        await nvim.call('eval', [`feedkeys("${key}", "${remap ? 'i' : 'in'}")`]);
        this.prompt.start();
    }
    async command(command) {
        let { nvim } = this;
        await nvim.call('coc#list#stop_prompt', [1]);
        await nvim.command(command);
        this.prompt.start();
    }
    async normal(command, bang = true) {
        let { nvim } = this;
        await nvim.call('coc#list#stop_prompt', [1]);
        await nvim.command(`normal${bang ? '!' : ''} ${command}`);
        this.prompt.start();
    }
    async call(fname) {
        if (this.session)
            return await this.session.call(fname);
    }
    get session() {
        return this.lastSession;
    }
    registerList(list) {
        const { name } = list;
        let exists = this.listMap.get(name);
        if (this.listMap.has(name)) {
            if (exists) {
                if (typeof exists.dispose == 'function') {
                    exists.dispose();
                }
                this.listMap.delete(name);
            }
            workspace_1.default.showMessage(`list "${name}" recreated.`);
        }
        this.listMap.set(name, list);
        extensions_1.default.addSchemeProperty(`list.source.${name}.defaultOptions`, {
            type: 'array',
            default: list.interactive ? ['--interactive'] : [],
            description: `Default list options of "${name}" list, only used when both list option and argument are empty.`,
            uniqueItems: true,
            items: {
                type: 'string',
                enum: ['--top', '--normal', '--no-sort', '--input', '--tab',
                    '--strict', '--regex', '--ignore-case', '--number-select',
                    '--interactive', '--auto-preview', '--first', '--no-quit']
            }
        });
        extensions_1.default.addSchemeProperty(`list.source.${name}.defaultArgs`, {
            type: 'array',
            default: [],
            description: `Default argument list of "${name}" list, only used when list argument is empty.`,
            uniqueItems: true,
            items: { type: 'string' }
        });
        return vscode_languageserver_protocol_1.Disposable.create(() => {
            if (typeof list.dispose == 'function') {
                list.dispose();
            }
            this.listMap.delete(name);
        });
    }
    get names() {
        return Array.from(this.listMap.keys());
    }
    get descriptions() {
        let d = {};
        for (let name of this.listMap.keys()) {
            let list = this.listMap.get(name);
            d[name] = list.description;
        }
        return d;
    }
    /**
     * Get items of {name} list, not work with interactive list and list return task.
     *
     * @param {string} name
     * @returns {Promise<any>}
     */
    async loadItems(name) {
        let args = [name];
        let res = this.parseArgs(args);
        if (!res)
            return;
        let { list, options, listArgs } = res;
        let source = new vscode_languageserver_protocol_1.CancellationTokenSource();
        let token = source.token;
        let arr = await this.nvim.eval('[win_getid(),bufnr("%")]');
        let items = await list.loadItems({
            options,
            args: listArgs,
            input: '',
            cwd: workspace_1.default.cwd,
            window: this.nvim.createWindow(arr[0]),
            buffer: this.nvim.createBuffer(arr[1]),
            listWindow: null
        }, token);
        return items;
    }
    toggleMode() {
        let lastSession = this.lastSession;
        if (lastSession)
            lastSession.toggleMode();
    }
    get isActivated() {
        var _a;
        return ((_a = this.session) === null || _a === void 0 ? void 0 : _a.winid) != null;
    }
    stop() {
        let lastSession = this.lastSession;
        if (lastSession)
            lastSession.stop();
    }
    async getCharMap() {
        if (this.charMap)
            return;
        this.charMap = new Map();
        let chars = await this.nvim.call('coc#list#get_chars');
        Object.keys(chars).forEach(key => {
            this.charMap.set(chars[key], key);
        });
        return;
    }
    dispose() {
        for (let session of this.sessionsMap.values()) {
            session.dispose();
        }
        this.sessionsMap.clear();
        if (this.config) {
            this.config.dispose();
        }
        this.lastSession = undefined;
        util_1.disposeAll(this.disposables);
    }
}
exports.ListManager = ListManager;
exports.default = new ListManager();
//# sourceMappingURL=manager.js.map