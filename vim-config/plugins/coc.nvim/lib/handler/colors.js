"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const vscode_languageserver_protocol_1 = require("vscode-languageserver-protocol");
const events_1 = tslib_1.__importDefault(require("../events"));
const extensions_1 = tslib_1.__importDefault(require("../extensions"));
const languages_1 = tslib_1.__importDefault(require("../languages"));
const util_1 = require("../util");
const workspace_1 = tslib_1.__importDefault(require("../workspace"));
const highlighter_1 = tslib_1.__importStar(require("./highlighter"));
const logger = require('../util/logger')('colors');
class Colors {
    constructor(nvim) {
        this.nvim = nvim;
        this._enabled = true;
        this.srcId = 1090;
        this.disposables = [];
        this.highlighters = new Map();
        if (workspace_1.default.isVim && !workspace_1.default.env.textprop) {
            return;
        }
        workspace_1.default.documents.forEach(doc => {
            this.createHighlighter(doc.bufnr);
        });
        workspace_1.default.onDidOpenTextDocument(e => {
            let doc = workspace_1.default.getDocument(e.uri);
            let highlighter = this.createHighlighter(doc.bufnr);
            if (highlighter && this.enabled)
                highlighter.highlight();
        });
        workspace_1.default.onDidChangeTextDocument(({ bufnr }) => {
            let highlighter = this.highlighters.get(bufnr);
            if (highlighter && this.enabled)
                highlighter.highlight();
        }, null, this.disposables);
        events_1.default.on('BufUnload', async (bufnr) => {
            let highlighter = this.highlighters.get(bufnr);
            if (!highlighter)
                return;
            this.highlighters.delete(bufnr);
            highlighter.dispose();
        }, null, this.disposables);
        let config = workspace_1.default.getConfiguration('coc.preferences');
        this._enabled = config.get('colorSupport', true);
        this.srcId = workspace_1.default.createNameSpace('coc-colors');
        extensions_1.default.onDidLoadExtension(() => {
            this.highlightAll();
        }, null, this.disposables);
        events_1.default.on('InsertLeave', async () => {
            if (process.env.NODE_ENV == 'test')
                return;
            this.highlightAll();
        }, null, this.disposables);
        workspace_1.default.onDidChangeConfiguration(async (e) => {
            if (e.affectsConfiguration('coc.preferences.colorSupport')) {
                let config = workspace_1.default.getConfiguration('coc.preferences');
                this._enabled = config.get('colorSupport', true);
                if (!this._enabled) {
                    for (let highlighter of this.highlighters.values()) {
                        highlighter.cancel();
                        highlighter.clearHighlight();
                    }
                }
                else {
                    this.highlightAll();
                }
            }
        }, null, this.disposables);
    }
    async pickPresentation() {
        let info = await this.currentColorInfomation();
        if (!info)
            return workspace_1.default.showMessage('Color not found at current position', 'warning');
        let document = await workspace_1.default.document;
        let tokenSource = new vscode_languageserver_protocol_1.CancellationTokenSource();
        let presentations = await languages_1.default.provideColorPresentations(info, document.textDocument, tokenSource.token);
        if (!presentations || presentations.length == 0)
            return;
        let res = await workspace_1.default.showQuickpick(presentations.map(o => o.label), 'choose a color presentation:');
        if (res == -1)
            return;
        let presentation = presentations[res];
        let { textEdit, additionalTextEdits, label } = presentation;
        if (!textEdit)
            textEdit = { range: info.range, newText: label };
        await document.applyEdits([textEdit]);
        if (additionalTextEdits) {
            await document.applyEdits(additionalTextEdits);
        }
    }
    async pickColor() {
        let info = await this.currentColorInfomation();
        if (!info)
            return workspace_1.default.showMessage('Color not found at current position', 'warning');
        let { color } = info;
        let colorArr = [(color.red * 255).toFixed(0), (color.green * 255).toFixed(0), (color.blue * 255).toFixed(0)];
        let res = await this.nvim.call('coc#util#pick_color', [colorArr]);
        if (res === false) {
            // cancel
            return;
        }
        if (!res || res.length != 3) {
            workspace_1.default.showMessage('Failed to get color', 'warning');
            return;
        }
        let hex = highlighter_1.toHexString({
            red: (res[0] / 65535),
            green: (res[1] / 65535),
            blue: (res[2] / 65535),
            alpha: 1
        });
        let document = await workspace_1.default.document;
        await document.applyEdits([{
                range: info.range,
                newText: `#${hex}`
            }]);
    }
    get enabled() {
        return this._enabled;
    }
    clearHighlight(bufnr) {
        let highlighter = this.highlighters.get(bufnr);
        if (!highlighter)
            return;
        highlighter.clearHighlight();
    }
    hasColor(bufnr) {
        let highlighter = this.highlighters.get(bufnr);
        if (!highlighter)
            return false;
        return highlighter.hasColor();
    }
    hasColorAtPostion(bufnr, position) {
        let highlighter = this.highlighters.get(bufnr);
        if (!highlighter)
            return false;
        return highlighter.hasColorAtPostion(position);
    }
    dispose() {
        for (let highlighter of this.highlighters.values()) {
            highlighter.dispose();
        }
        util_1.disposeAll(this.disposables);
    }
    highlightAll() {
        if (!this.enabled)
            return;
        workspace_1.default.documents.forEach(doc => {
            let highlighter = this.highlighters.get(doc.bufnr);
            if (highlighter)
                highlighter.highlight();
        });
    }
    async doHighlight(bufnr) {
        let highlighter = this.highlighters.get(bufnr);
        if (!highlighter)
            return;
        await highlighter.doHighlight();
    }
    createHighlighter(bufnr) {
        let doc = workspace_1.default.getDocument(bufnr);
        if (!doc || !isValid(doc))
            return null;
        let obj = new highlighter_1.default(this.nvim, bufnr, this.srcId);
        this.highlighters.set(bufnr, obj);
        return obj;
    }
    async currentColorInfomation() {
        let bufnr = await this.nvim.call('bufnr', '%');
        let highlighter = this.highlighters.get(bufnr);
        if (!highlighter)
            return null;
        let position = await workspace_1.default.getCursorPosition();
        for (let info of highlighter.colors) {
            let { range } = info;
            let { start, end } = range;
            if (position.line == start.line
                && position.character >= start.character
                && position.character <= end.character) {
                return info;
            }
        }
        return null;
    }
}
exports.default = Colors;
function isValid(document) {
    if (['help', 'terminal', 'quickfix'].includes(document.buftype))
        return false;
    return true;
}
//# sourceMappingURL=colors.js.map