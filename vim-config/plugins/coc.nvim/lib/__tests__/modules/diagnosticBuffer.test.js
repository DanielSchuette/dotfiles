"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const helper_1 = tslib_1.__importDefault(require("../helper"));
const buffer_1 = require("../../diagnostic/buffer");
const vscode_languageserver_types_1 = require("vscode-languageserver-types");
let nvim;
const config = {
    checkCurrentLine: false,
    locationlistUpdate: true,
    enableSign: true,
    enableHighlightLineNumber: true,
    maxWindowHeight: 8,
    maxWindowWidth: 80,
    enableMessage: 'always',
    messageTarget: 'echo',
    messageDelay: 250,
    refreshOnInsertMode: false,
    virtualTextSrcId: 0,
    virtualText: false,
    virtualTextCurrentLineOnly: true,
    virtualTextPrefix: " ",
    virtualTextLines: 3,
    virtualTextLineSeparator: " \\ ",
    displayByAle: false,
    srcId: 1000,
    level: vscode_languageserver_types_1.DiagnosticSeverity.Hint,
    signOffset: 1000,
    errorSign: '>>',
    warningSign: '>>',
    infoSign: '>>',
    refreshAfterSave: false,
    hintSign: '>>',
    filetypeMap: {
        default: ''
    },
};
async function createDiagnosticBuffer() {
    let doc = await helper_1.default.createDocument();
    return new buffer_1.DiagnosticBuffer(doc.bufnr, doc.uri, config);
}
function createDiagnostic(msg, range, severity) {
    range = range ? range : vscode_languageserver_types_1.Range.create(0, 0, 0, 1);
    return vscode_languageserver_types_1.Diagnostic.create(range, msg, severity || vscode_languageserver_types_1.DiagnosticSeverity.Error, 999, 'test');
}
beforeAll(async () => {
    await helper_1.default.setup();
    nvim = helper_1.default.nvim;
});
afterAll(async () => {
    await helper_1.default.shutdown();
});
afterEach(async () => {
    await helper_1.default.reset();
});
describe('diagnostic buffer', () => {
    it('should check signs', async () => {
        let buf = await createDiagnosticBuffer();
        await nvim.setLine('foo');
        await nvim.command(`sign place 1005 line=1 name=CocError buffer=${buf.bufnr}`);
        await nvim.command(`sign place 1006 line=1 name=CocError buffer=${buf.bufnr}`);
        await buf.checkSigns();
        let content = await nvim.call('execute', [`sign place buffer=${buf.bufnr}`]);
        let lines = content.split('\n');
        let line = lines.find(s => s.includes('CocError'));
        expect(line).toBeUndefined();
    });
    it('should add signs', async () => {
        let diagnostics = [createDiagnostic('foo'), createDiagnostic('bar')];
        let buf = await createDiagnosticBuffer();
        buf.addSigns(diagnostics);
        await helper_1.default.wait(30);
        let content = await nvim.call('execute', [`sign place buffer=${buf.bufnr}`]);
        let lines = content.split('\n');
        let line = lines.find(s => s.includes('CocError'));
        expect(line).toBeDefined();
    });
    it('should set diagnostic info', async () => {
        let r = vscode_languageserver_types_1.Range.create(0, 1, 0, 2);
        let diagnostics = [
            createDiagnostic('foo', r, vscode_languageserver_types_1.DiagnosticSeverity.Error),
            createDiagnostic('bar', r, vscode_languageserver_types_1.DiagnosticSeverity.Warning),
            createDiagnostic('foo', r, vscode_languageserver_types_1.DiagnosticSeverity.Hint),
            createDiagnostic('bar', r, vscode_languageserver_types_1.DiagnosticSeverity.Information)
        ];
        let buf = await createDiagnosticBuffer();
        buf.setDiagnosticInfo(diagnostics);
        let buffer = await nvim.buffer;
        let res = await buffer.getVar('coc_diagnostic_info');
        expect(res).toEqual({
            lnums: [1, 1, 1, 1],
            information: 1,
            hint: 1,
            warning: 1,
            error: 1
        });
    });
    it('should add highlight neovim', async () => {
        let diagnostic = createDiagnostic('foo');
        let buf = await createDiagnosticBuffer();
        buf.addHighlight([diagnostic], buf.bufnr);
        expect(buf.hasHighlights()).toBe(true);
    });
    it('should clear all diagnostics', async () => {
        let diagnostic = createDiagnostic('foo');
        let buf = await createDiagnosticBuffer();
        let diagnostics = [diagnostic];
        buf.refresh(diagnostics);
        await helper_1.default.wait(100);
        await buf.clear();
        let content = await nvim.call('execute', [`sign place buffer=${buf.bufnr}`]);
        let lines = content.split('\n');
        let line = lines.find(s => s.includes('CocError'));
        expect(line).toBeUndefined();
        await helper_1.default.wait(50);
        let buffer = await nvim.buffer;
        let res = await buffer.getVar("coc_diagnostic_info");
        expect(res).toEqual({ lnums: [0, 0, 0, 0], error: 0, hint: 0, information: 0, warning: 0 });
        let { matchIds } = buf;
        expect(matchIds.size).toBe(0);
    });
});
//# sourceMappingURL=diagnosticBuffer.test.js.map