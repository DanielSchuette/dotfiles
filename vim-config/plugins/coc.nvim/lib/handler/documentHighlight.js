"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const vscode_languageserver_protocol_1 = require("vscode-languageserver-protocol");
const events_1 = tslib_1.__importDefault(require("../events"));
const languages_1 = tslib_1.__importDefault(require("../languages"));
const util_1 = require("../util");
const workspace_1 = tslib_1.__importDefault(require("../workspace"));
const logger = require('../util/logger')('documentHighlight');
class DocumentHighlighter {
    constructor(nvim, colors) {
        this.nvim = nvim;
        this.colors = colors;
        this.disposables = [];
        events_1.default.on('WinLeave', () => {
            this.cancel();
        }, null, this.disposables);
        events_1.default.on('BufWinEnter', () => {
            this.cancel();
        }, null, this.disposables);
        events_1.default.on('CursorMoved', () => {
            this.cancel();
        }, null, this.disposables);
        events_1.default.on('InsertEnter', () => {
            this.clearHighlight();
        }, null, this.disposables);
    }
    clearHighlight(winid) {
        let { nvim } = workspace_1.default;
        nvim.call('coc#util#clear_highlights', winid ? [winid] : [], true);
        if (workspace_1.default.isVim)
            nvim.command('redraw', true);
    }
    async highlight(bufnr, winid, position) {
        let { nvim } = this;
        let doc = workspace_1.default.getDocument(bufnr);
        this.cancel();
        let highlights = await this.getHighlights(doc, position);
        if (!highlights || highlights.length == 0) {
            this.clearHighlight(winid);
            return;
        }
        if (workspace_1.default.bufnr != bufnr)
            return;
        nvim.pauseNotification();
        nvim.call('coc#util#clear_highlights', [winid], true);
        let groups = {};
        for (let hl of highlights) {
            if (!hl.range)
                continue;
            let hlGroup = hl.kind == vscode_languageserver_protocol_1.DocumentHighlightKind.Text
                ? 'CocHighlightText'
                : hl.kind == vscode_languageserver_protocol_1.DocumentHighlightKind.Read ? 'CocHighlightRead' : 'CocHighlightWrite';
            groups[hlGroup] = groups[hlGroup] || [];
            groups[hlGroup].push(hl.range);
        }
        for (let hlGroup of Object.keys(groups)) {
            doc.matchAddRanges(groups[hlGroup], hlGroup, -1);
        }
        this.nvim.command('redraw', true);
        await this.nvim.resumeNotification(false, true);
    }
    async getHighlights(doc, position) {
        if (!doc || !doc.attached || doc.isCommandLine)
            return null;
        let { bufnr } = doc;
        let line = doc.getline(position.line);
        let ch = line[position.character];
        if (!ch || !doc.isWord(ch) || this.colors.hasColorAtPostion(bufnr, position))
            return null;
        try {
            this.tokenSource = new vscode_languageserver_protocol_1.CancellationTokenSource();
            let { token } = this.tokenSource;
            let highlights = await languages_1.default.getDocumentHighLight(doc.textDocument, position, token);
            this.tokenSource = null;
            if (token.isCancellationRequested)
                return null;
            return highlights;
        }
        catch (_e) {
            return null;
        }
    }
    cancel() {
        if (this.tokenSource) {
            this.tokenSource.cancel();
            this.tokenSource.dispose();
            this.tokenSource = null;
        }
    }
    dispose() {
        if (this.tokenSource)
            this.tokenSource.dispose();
        util_1.disposeAll(this.disposables);
    }
}
exports.default = DocumentHighlighter;
//# sourceMappingURL=documentHighlight.js.map