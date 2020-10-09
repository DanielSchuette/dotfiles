"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toHexString = void 0;
const tslib_1 = require("tslib");
const debounce_1 = tslib_1.__importDefault(require("debounce"));
const vscode_languageserver_protocol_1 = require("vscode-languageserver-protocol");
const util_1 = require("../util");
const array_1 = require("../util/array");
const object_1 = require("../util/object");
const position_1 = require("../util/position");
const workspace_1 = tslib_1.__importDefault(require("../workspace"));
const languages_1 = tslib_1.__importDefault(require("../languages"));
const logger = require('../util/logger')('highlighter');
const usedColors = new Set();
class Highlighter {
    // last highlight version
    constructor(nvim, bufnr, srcId) {
        this.nvim = nvim;
        this.bufnr = bufnr;
        this.srcId = srcId;
        this._colors = [];
        this.highlight = debounce_1.default(() => {
            this.doHighlight().catch(e => {
                logger.error('Error on color highlight:', e.stack);
            });
        }, 500);
    }
    get buffer() {
        return this.nvim.createBuffer(this.bufnr);
    }
    get colors() {
        return this._colors;
    }
    hasColor() {
        return this._colors.length > 0;
    }
    async doHighlight() {
        let doc = workspace_1.default.getDocument(this.bufnr);
        if (!doc)
            return;
        try {
            this.cancel();
            this.tokenSource = new vscode_languageserver_protocol_1.CancellationTokenSource();
            let { token } = this.tokenSource;
            await synchronizeDocument(doc);
            if (workspace_1.default.insertMode)
                return;
            if (token.isCancellationRequested)
                return;
            if (this.version && doc.version == this.version)
                return;
            let { version } = doc;
            let colors;
            usedColors.clear();
            colors = await languages_1.default.provideDocumentColors(doc.textDocument, token);
            colors = colors || [];
            if (token.isCancellationRequested)
                return;
            this.version = version;
            await this.addHighlight(doc, colors, token);
        }
        catch (e) {
            logger.error('Error on highlight:', e);
        }
    }
    async addHighlight(doc, colors, token) {
        colors = colors || [];
        if (object_1.equals(this._colors, colors) || !doc)
            return;
        this._colors = colors;
        // improve performance
        let groups = array_1.group(colors, 100);
        let cleared = false;
        for (let colors of groups) {
            if (token.isCancellationRequested) {
                this._colors = [];
                return;
            }
            this.nvim.pauseNotification();
            if (!cleared) {
                this.buffer.clearHighlight({ srcId: this.srcId });
                cleared = true;
            }
            let colorRanges = this.getColorRanges(colors);
            this.addColors(colors.map(o => o.color));
            for (let o of colorRanges) {
                this.highlightColor(doc, o.ranges, o.color);
            }
            this.nvim.command('redraw', true);
            await this.nvim.resumeNotification();
        }
    }
    highlightColor(doc, ranges, color) {
        let { red, green, blue } = toHexColor(color);
        let hlGroup = `BG${toHexString(color)}`;
        doc.highlightRanges(ranges, hlGroup, this.srcId);
    }
    addColors(colors) {
        let commands = [];
        for (let color of colors) {
            let hex = toHexString(color);
            if (!usedColors.has(hex)) {
                commands.push(`hi BG${hex} guibg=#${hex} guifg=#${isDark(color) ? 'ffffff' : '000000'}`);
                usedColors.add(hex);
            }
        }
        this.nvim.command(commands.join('|'), true);
    }
    getColorRanges(infos) {
        let res = [];
        for (let info of infos) {
            let { color, range } = info;
            let idx = res.findIndex(o => object_1.equals(toHexColor(o.color), toHexColor(color)));
            if (idx == -1) {
                res.push({
                    color,
                    ranges: [range]
                });
            }
            else {
                let r = res[idx];
                r.ranges.push(range);
            }
        }
        return res;
    }
    clearHighlight() {
        this._colors = [];
        this.version = null;
        this.buffer.clearHighlight({ srcId: this.srcId });
    }
    hasColorAtPostion(position) {
        let { colors } = this;
        return colors.some(o => position_1.positionInRange(position, o.range) == 0);
    }
    cancel() {
        if (this.tokenSource) {
            this.tokenSource.cancel();
            this.tokenSource = null;
        }
    }
    dispose() {
        this.highlight.clear();
        if (this.tokenSource) {
            this.tokenSource.cancel();
            this.tokenSource.dispose();
        }
    }
}
exports.default = Highlighter;
function toHexString(color) {
    let c = toHexColor(color);
    return `${pad(c.red.toString(16))}${pad(c.green.toString(16))}${pad(c.blue.toString(16))}`;
}
exports.toHexString = toHexString;
function pad(str) {
    return str.length == 1 ? `0${str}` : str;
}
function toHexColor(color) {
    let { red, green, blue } = color;
    return {
        red: Math.round(red * 255),
        green: Math.round(green * 255),
        blue: Math.round(blue * 255)
    };
}
function isDark(color) {
    // http://www.w3.org/TR/WCAG20/#relativeluminancedef
    let rgb = [color.red, color.green, color.blue];
    let lum = [];
    for (let i = 0; i < rgb.length; i++) {
        let chan = rgb[i];
        lum[i] = (chan <= 0.03928) ? chan / 12.92 : Math.pow(((chan + 0.055) / 1.055), 2.4);
    }
    let luma = 0.2126 * lum[0] + 0.7152 * lum[1] + 0.0722 * lum[2];
    return luma <= 0.5;
}
async function synchronizeDocument(doc) {
    let { changedtick } = doc;
    await doc.patchChange();
    if (changedtick != doc.changedtick) {
        await util_1.wait(50);
    }
}
//# sourceMappingURL=highlighter.js.map