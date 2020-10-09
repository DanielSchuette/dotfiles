"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const debounce_1 = tslib_1.__importDefault(require("debounce"));
const vscode_languageserver_protocol_1 = require("vscode-languageserver-protocol");
const events_1 = tslib_1.__importDefault(require("../events"));
const util_1 = require("../util");
const mutex_1 = require("../util/mutex");
const workspace_1 = tslib_1.__importDefault(require("../workspace"));
const logger = require('../util/logger')('list-ui');
const StatusLineOption = [
    '%#CocListMode#-- %{get(b:list_status, "mode", "")} --%*',
    '%{get(b:list_status, "loading", "")}',
    '%{get(b:list_status, "args", "")}',
    '(%L/%{get(b:list_status, "total", "")})',
    '%=',
    '%#CocListPath# %{get(b:list_status, "cwd", "")} %l/%L%*'
].join(' ');
class ListUI {
    constructor(nvim, name, listOptions, config) {
        this.nvim = nvim;
        this.name = name;
        this.listOptions = listOptions;
        this.config = config;
        this.newTab = false;
        this.currIndex = 0;
        this.drawCount = 0;
        this.highlights = [];
        this.items = [];
        this.disposables = [];
        this.selected = new Set();
        this.mutex = new mutex_1.Mutex();
        this._onDidChangeLine = new vscode_languageserver_protocol_1.Emitter();
        this._onDidOpen = new vscode_languageserver_protocol_1.Emitter();
        this._onDidClose = new vscode_languageserver_protocol_1.Emitter();
        this._onDidLineChange = new vscode_languageserver_protocol_1.Emitter();
        this._onDoubleClick = new vscode_languageserver_protocol_1.Emitter();
        this.onDidChangeLine = this._onDidChangeLine.event;
        this.onDidLineChange = this._onDidLineChange.event;
        this.onDidOpen = this._onDidOpen.event;
        this.onDidClose = this._onDidClose.event;
        this.onDidDoubleClick = this._onDoubleClick.event;
        this.signOffset = config.get('signOffset');
        this.newTab = listOptions.position == 'tab';
        events_1.default.on('BufUnload', async (bufnr) => {
            if (bufnr != this.bufnr || this.window == null)
                return;
            this.window = null;
            this._onDidClose.fire(bufnr);
        }, null, this.disposables);
        events_1.default.on('CursorMoved', async (bufnr, cursor) => {
            if (bufnr != this.bufnr)
                return;
            this.onLineChange(cursor[0] - 1);
        }, null, this.disposables);
        let debounced = debounce_1.default(async (bufnr) => {
            if (bufnr != this.bufnr)
                return;
            let [winid, start, end] = await nvim.eval('[win_getid(),line("w0"),line("w$")]');
            if (end < 300)
                return;
            if (!this.window || winid != this.window.id)
                return;
            // increment highlights
            nvim.pauseNotification();
            this.doHighlight(start - 1, end);
            nvim.command('redraw', true);
            await nvim.resumeNotification(false, true);
        }, 100);
        this.disposables.push({
            dispose: () => {
                debounced.clear();
            }
        });
        events_1.default.on('CursorMoved', debounced, null, this.disposables);
    }
    get limitLines() {
        return this.config.get('limitLines', 30000);
    }
    onLineChange(index) {
        if (this.currIndex == index)
            return;
        this.currIndex = index;
        this._onDidChangeLine.fire(index);
    }
    set index(n) {
        if (n < 0 || n >= this.items.length)
            return;
        let { nvim } = this;
        nvim.pauseNotification();
        this.setCursor(n + 1, 0);
        nvim.command('redraw', true);
        nvim.resumeNotification(false, true).logError();
    }
    get index() {
        return this.currIndex;
    }
    get firstItem() {
        return this.items[0];
    }
    get lastItem() {
        return this.items[this.items.length - 1];
    }
    getItem(delta) {
        let { currIndex } = this;
        return this.items[currIndex + delta];
    }
    get item() {
        let { window } = this;
        if (!window)
            return Promise.resolve(null);
        return window.cursor.then(cursor => {
            this.currIndex = cursor[0] - 1;
            return this.items[this.currIndex];
        }, _e => null);
    }
    async echoMessage(item) {
        if (this.bufnr)
            return;
        let { items } = this;
        let idx = items.indexOf(item);
        let msg = `[${idx + 1}/${items.length}] ${item.label || ''}`;
        this.nvim.callTimer('coc#util#echo_lines', [[msg]], true);
    }
    async updateItem(item, index) {
        if (!this.bufnr || workspace_1.default.bufnr != this.bufnr)
            return;
        let obj = Object.assign({ resolved: true }, item);
        if (index < this.length) {
            this.items[index] = obj;
            let { nvim } = this;
            nvim.pauseNotification();
            nvim.command('setl modifiable', true);
            nvim.call('setline', [index + 1, obj.label], true);
            nvim.command('setl nomodifiable', true);
            await nvim.resumeNotification();
        }
    }
    async getItems() {
        if (this.length == 0 || !this.window)
            return [];
        let mode = await this.nvim.call('mode');
        if (mode == 'v' || mode == 'V') {
            let [start, end] = await this.getSelectedRange();
            let res = [];
            for (let i = start; i <= end; i++) {
                let item = this.items[i - 1];
                if (item)
                    res.push(item);
            }
            return res;
        }
        let { selectedItems } = this;
        if (selectedItems.length)
            return selectedItems;
        let item = await this.item;
        return item == null ? [] : [item];
    }
    async onMouse(event) {
        let { nvim, window } = this;
        let winid = await nvim.getVvar('mouse_winid');
        if (!window)
            return;
        let lnum = await nvim.getVvar('mouse_lnum');
        let col = await nvim.getVvar('mouse_col');
        if (event == 'mouseDown') {
            this.mouseDown = { winid, lnum, col, current: winid == window.id };
            return;
        }
        let current = winid == window.id;
        if (current && event == 'doubleClick') {
            this.setCursor(lnum, 0);
            this._onDoubleClick.fire();
        }
        if (!this.mouseDown || this.mouseDown.winid != this.mouseDown.winid)
            return;
        if (current && event == 'mouseDrag') {
            await this.selectLines(this.mouseDown.lnum, lnum);
        }
        else if (current && event == 'mouseUp') {
            if (this.mouseDown.lnum == lnum) {
                nvim.pauseNotification();
                this.clearSelection();
                this.setCursor(lnum, 0);
                nvim.command('redraw', true);
                await nvim.resumeNotification();
            }
            else {
                await this.selectLines(this.mouseDown.lnum, lnum);
            }
        }
        else if (!current && event == 'mouseUp') {
            nvim.pauseNotification();
            nvim.call('win_gotoid', winid, true);
            nvim.call('cursor', [lnum, col], true);
            await nvim.resumeNotification();
        }
    }
    async resume() {
        let { items, selected, nvim, signOffset } = this;
        await this.drawItems(items, this.height, true);
        if (selected.size > 0 && this.bufnr) {
            nvim.pauseNotification();
            for (let lnum of selected) {
                nvim.command(`sign place ${signOffset + lnum} line=${lnum} name=CocSelected buffer=${this.bufnr}`, true);
            }
            await nvim.resumeNotification();
        }
    }
    async toggleSelection() {
        let { nvim, selected, signOffset, bufnr } = this;
        if (workspace_1.default.bufnr != bufnr)
            return;
        let lnum = await nvim.call('line', '.');
        let mode = await nvim.call('mode');
        if (mode == 'v' || mode == 'V') {
            let [start, end] = await this.getSelectedRange();
            let exists = selected.has(start);
            let reverse = start > end;
            if (reverse)
                [start, end] = [end, start];
            for (let i = start; i <= end; i++) {
                if (!exists) {
                    selected.add(i);
                    nvim.command(`sign place ${signOffset + i} line=${i} name=CocSelected buffer=${bufnr}`, true);
                }
                else {
                    selected.delete(i);
                    nvim.command(`sign unplace ${signOffset + i} buffer=${bufnr}`, true);
                }
            }
            this.setCursor(end, 0);
            nvim.command('redraw', true);
            await nvim.resumeNotification();
            return;
        }
        let exists = selected.has(lnum);
        nvim.pauseNotification();
        if (exists) {
            selected.delete(lnum);
            nvim.command(`sign unplace ${signOffset + lnum} buffer=${bufnr}`, true);
        }
        else {
            selected.add(lnum);
            nvim.command(`sign place ${signOffset + lnum} line=${lnum} name=CocSelected buffer=${bufnr}`, true);
        }
        this.setCursor(lnum + 1, 0);
        nvim.command('redraw', true);
        await nvim.resumeNotification();
    }
    async selectLines(start, end) {
        let { nvim, signOffset, bufnr, length } = this;
        this.clearSelection();
        let { selected } = this;
        nvim.pauseNotification();
        let reverse = start > end;
        if (reverse)
            [start, end] = [end, start];
        for (let i = start; i <= end; i++) {
            if (i > length)
                break;
            selected.add(i);
            nvim.command(`sign place ${signOffset + i} line=${i} name=CocSelected buffer=${bufnr}`, true);
        }
        this.setCursor(end, 0);
        nvim.command('redraw', true);
        await nvim.resumeNotification();
    }
    async selectAll() {
        let { length } = this;
        if (length == 0)
            return;
        await this.selectLines(1, length);
    }
    clearSelection() {
        let { selected, nvim, signOffset, bufnr } = this;
        if (!bufnr)
            return;
        if (selected.size > 0) {
            let signIds = [];
            for (let lnum of selected) {
                signIds.push(signOffset + lnum);
            }
            nvim.call('coc#util#unplace_signs', [bufnr, signIds], true);
            this.selected = new Set();
        }
    }
    get shown() {
        return this.window != null;
    }
    get bufnr() {
        var _a;
        return (_a = this.buffer) === null || _a === void 0 ? void 0 : _a.id;
    }
    get winid() {
        var _a;
        return (_a = this.window) === null || _a === void 0 ? void 0 : _a.id;
    }
    get ready() {
        if (this.window)
            return Promise.resolve();
        return new Promise((resolve, reject) => {
            let timeout = setTimeout(() => {
                reject(new Error('window create timeout'));
            }, 3000);
            let disposable = this.onDidLineChange(() => {
                disposable.dispose();
                clearTimeout(timeout);
                resolve();
            });
        });
    }
    async drawItems(items, height, reload = false) {
        let count = this.drawCount = this.drawCount + 1;
        const { nvim, name, listOptions } = this;
        const release = await this.mutex.acquire();
        this.items = items.length > this.limitLines ? items.slice(0, this.limitLines) : items;
        const create = this.window == null;
        if (create) {
            try {
                let { position, numberSelect } = listOptions;
                let [bufnr, winid] = await nvim.call('coc#list#create', [position, height, name, numberSelect]);
                this.height = height;
                this.buffer = nvim.createBuffer(bufnr);
                this.window = nvim.createWindow(winid);
                this._onDidOpen.fire(this.bufnr);
            }
            catch (e) {
                release();
                workspace_1.default.showMessage(`Error on list create: ${e.message}`, 'error');
                return;
            }
        }
        release();
        if (count !== this.drawCount)
            return;
        let lines = this.items.map(item => item.label);
        this.clearSelection();
        let newIndex = reload ? this.currIndex : 0;
        await this.setLines(lines, false, newIndex);
        this._onDidLineChange.fire(this.currIndex + 1);
    }
    async appendItems(items) {
        if (!this.window)
            return;
        let curr = this.items.length;
        if (curr >= this.limitLines)
            return;
        let max = this.limitLines - curr;
        let append = items.slice(0, max);
        this.items = this.items.concat(append);
        await this.setLines(append.map(item => item.label), curr > 0, this.currIndex);
    }
    async setLines(lines, append = false, index) {
        let { nvim, buffer, window } = this;
        if (!buffer || !window)
            return;
        nvim.pauseNotification();
        nvim.call('coc#util#win_gotoid', [window.id], true);
        if (!append) {
            window.notify('nvim_win_set_option', ['statusline', StatusLineOption]);
            nvim.call('clearmatches', [], true);
            if (!lines.length) {
                lines = ['No results, press ? on normal mode to get help.'];
                nvim.call('matchaddpos', ['Comment', [[1]], 99], true);
            }
        }
        buffer.setOption('modifiable', true, true);
        if (workspace_1.default.isVim) {
            nvim.call('coc#list#setlines', [lines, append], true);
        }
        else {
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            buffer.setLines(lines, { start: append ? -1 : 0, end: -1, strictIndexing: false }, true);
        }
        buffer.setOption('modifiable', false, true);
        if (!append && index == 0) {
            this.doHighlight(0, 300);
        }
        else {
            let height = this.newTab ? workspace_1.default.env.lines : this.height;
            this.doHighlight(Math.max(0, index - height), Math.min(index + height + 1, this.length - 1));
        }
        if (!append) {
            this.currIndex = index;
            window.notify('nvim_win_set_cursor', [[index + 1, 0]]);
        }
        nvim.command('redraws', true);
        if (workspace_1.default.isVim)
            nvim.command('redraw', true);
        let res = await nvim.resumeNotification();
        if (Array.isArray(res[1]) && res[1][0] == 0) {
            this.window = null;
        }
    }
    restoreWindow() {
        if (this.newTab)
            return;
        let { window, height } = this;
        if (window && height) {
            this.nvim.call('coc#list#restore', [window.id, height], true);
        }
    }
    close() {
        if (this.window) {
            this.window.close(true, true);
            this.window = null;
        }
    }
    dispose() {
        this.close();
        util_1.disposeAll(this.disposables);
        this._onDidChangeLine.dispose();
        this._onDidOpen.dispose();
        this._onDidClose.dispose();
        this._onDidLineChange.dispose();
        this._onDoubleClick.dispose();
    }
    get length() {
        return this.items.length;
    }
    get selectedItems() {
        let { selected, items } = this;
        let res = [];
        for (let i of selected) {
            if (items[i - 1])
                res.push(items[i - 1]);
        }
        return res;
    }
    doHighlight(start, end) {
        let { nvim } = workspace_1.default;
        let { highlights, items } = this;
        for (let i = start; i <= Math.min(end, items.length - 1); i++) {
            let { ansiHighlights } = items[i];
            let highlight = highlights[i];
            if (ansiHighlights) {
                for (let hi of ansiHighlights) {
                    let { span, hlGroup } = hi;
                    nvim.call('matchaddpos', [hlGroup, [[i + 1, span[0] + 1, span[1] - span[0]]], 9], true);
                }
            }
            if (highlight) {
                let { spans, hlGroup } = highlight;
                for (let span of spans) {
                    nvim.call('matchaddpos', [hlGroup || 'Search', [[i + 1, span[0] + 1, span[1] - span[0]]], 11], true);
                }
            }
        }
    }
    setCursor(lnum, col) {
        let { window, items } = this;
        let max = items.length == 0 ? 1 : items.length;
        if (lnum > max)
            return;
        // change index since CursorMoved event not fired (seems bug of neovim)!
        this.onLineChange(lnum - 1);
        if (window)
            window.notify('nvim_win_set_cursor', [[lnum, col]]);
    }
    addHighlights(highlights, append = false) {
        let { limitLines } = this;
        if (!append) {
            this.highlights = highlights.slice(0, limitLines);
        }
        else {
            if (this.highlights.length < limitLines) {
                this.highlights.push(...highlights.slice(0, limitLines - this.highlights.length));
            }
        }
    }
    async getSelectedRange() {
        let { nvim } = this;
        await nvim.call('coc#list#stop_prompt');
        await nvim.eval('feedkeys("\\<esc>", "in")');
        let [, start] = await nvim.call('getpos', "'<");
        let [, end] = await nvim.call('getpos', "'>");
        if (start > end) {
            [start, end] = [end, start];
        }
        this.nvim.call('coc#list#start_prompt', [], true);
        return [start, end];
    }
}
exports.default = ListUI;
//# sourceMappingURL=ui.js.map