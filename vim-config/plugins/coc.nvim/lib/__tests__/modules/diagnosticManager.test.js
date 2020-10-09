"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const util_1 = require("../../diagnostic/util");
const vscode_languageserver_types_1 = require("vscode-languageserver-types");
const vscode_uri_1 = require("vscode-uri");
const workspace_1 = tslib_1.__importDefault(require("../../workspace"));
const manager_1 = tslib_1.__importDefault(require("../../diagnostic/manager"));
const helper_1 = tslib_1.__importDefault(require("../helper"));
let nvim;
function createDiagnostic(msg, range, severity) {
    range = range ? range : vscode_languageserver_types_1.Range.create(0, 0, 0, 1);
    return vscode_languageserver_types_1.Diagnostic.create(range, msg, severity || vscode_languageserver_types_1.DiagnosticSeverity.Error);
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
async function createDocument() {
    let doc = await helper_1.default.createDocument();
    let collection = manager_1.default.create('test');
    let diagnostics = [];
    await doc.buffer.setLines(['foo bar foo bar', 'foo bar', 'foo', 'bar'], {
        start: 0,
        end: -1,
        strictIndexing: false
    });
    diagnostics.push(createDiagnostic('error', vscode_languageserver_types_1.Range.create(0, 2, 0, 4), vscode_languageserver_types_1.DiagnosticSeverity.Error));
    diagnostics.push(createDiagnostic('warning', vscode_languageserver_types_1.Range.create(0, 5, 0, 6), vscode_languageserver_types_1.DiagnosticSeverity.Warning));
    diagnostics.push(createDiagnostic('information', vscode_languageserver_types_1.Range.create(1, 0, 1, 1), vscode_languageserver_types_1.DiagnosticSeverity.Information));
    diagnostics.push(createDiagnostic('hint', vscode_languageserver_types_1.Range.create(1, 2, 1, 3), vscode_languageserver_types_1.DiagnosticSeverity.Hint));
    diagnostics.push(createDiagnostic('error', vscode_languageserver_types_1.Range.create(2, 0, 2, 2), vscode_languageserver_types_1.DiagnosticSeverity.Error));
    collection.set(doc.uri, diagnostics);
    manager_1.default.refreshBuffer(doc.uri, true);
    doc.forceSync();
    return doc;
}
describe('diagnostic manager', () => {
    it('should get all diagnostics', async () => {
        await createDocument();
        let list = manager_1.default.getDiagnosticList();
        expect(list).toBeDefined();
        expect(list.length).toBeGreaterThanOrEqual(5);
        expect(list[0].severity).toBe('Error');
        expect(list[1].severity).toBe('Error');
        expect(list[2].severity).toBe('Warning');
        expect(list[3].severity).toBe('Information');
        expect(list[4].severity).toBe('Hint');
    });
    it('should refresh on InsertLeave', async () => {
        let doc = await helper_1.default.createDocument();
        await nvim.input('i');
        let collection = manager_1.default.create('test');
        let diagnostics = [];
        await doc.buffer.setLines(['foo bar foo bar', 'foo bar', 'foo', 'bar'], {
            start: 0,
            end: -1,
            strictIndexing: false
        });
        diagnostics.push(createDiagnostic('error', vscode_languageserver_types_1.Range.create(0, 2, 0, 4), vscode_languageserver_types_1.DiagnosticSeverity.Error));
        collection.set(doc.uri, diagnostics);
        await helper_1.default.wait(30);
        await nvim.input('<esc>');
        await helper_1.default.wait(600);
    });
    it('should create diagnostic collection', async () => {
        let doc = await helper_1.default.createDocument();
        let collection = manager_1.default.create('test');
        collection.set(doc.uri, [createDiagnostic('foo')]);
        await helper_1.default.wait(100);
        let info = await doc.buffer.getVar('coc_diagnostic_info');
        expect(info).toBeDefined();
    });
    it('should get sorted ranges of document', async () => {
        let doc = await helper_1.default.createDocument();
        let collection = manager_1.default.create('test');
        let diagnostics = [];
        diagnostics.push(createDiagnostic('x', vscode_languageserver_types_1.Range.create(0, 0, 0, 1)));
        diagnostics.push(createDiagnostic('y', vscode_languageserver_types_1.Range.create(0, 1, 0, 2)));
        diagnostics.push(createDiagnostic('z', vscode_languageserver_types_1.Range.create(1, 0, 1, 2)));
        collection.set(doc.uri, diagnostics);
        let ranges = manager_1.default.getSortedRanges(doc.uri);
        expect(ranges[0]).toEqual(vscode_languageserver_types_1.Range.create(0, 0, 0, 1));
        expect(ranges[1]).toEqual(vscode_languageserver_types_1.Range.create(0, 1, 0, 2));
        expect(ranges[2]).toEqual(vscode_languageserver_types_1.Range.create(1, 0, 1, 2));
        ranges = manager_1.default.getSortedRanges(doc.uri, 'error');
        expect(ranges.length).toBe(3);
        expect(manager_1.default.getSortedRanges(doc.uri, 'warning').length).toBe(0);
    });
    it('should get diagnostics in range', async () => {
        let doc = await helper_1.default.createDocument();
        let collection = manager_1.default.create('test');
        let diagnostics = [];
        await doc.buffer.setLines(['foo bar foo bar', 'foo bar'], {
            start: 0,
            end: -1,
            strictIndexing: false
        });
        await helper_1.default.wait(300);
        diagnostics.push(createDiagnostic('a', vscode_languageserver_types_1.Range.create(0, 0, 0, 1)));
        diagnostics.push(createDiagnostic('b', vscode_languageserver_types_1.Range.create(0, 2, 0, 3)));
        diagnostics.push(createDiagnostic('c', vscode_languageserver_types_1.Range.create(1, 0, 1, 2)));
        collection.set(doc.uri, diagnostics);
        let res = manager_1.default.getDiagnosticsInRange(doc.textDocument, vscode_languageserver_types_1.Range.create(0, 0, 0, 3));
        expect(res.length).toBe(2);
    });
    it('should get diagnostics under corsor', async () => {
        let config = workspace_1.default.getConfiguration('diagnostic');
        await createDocument();
        let diagnostics = await manager_1.default.getCurrentDiagnostics();
        expect(diagnostics.length).toBe(0);
        await nvim.call('cursor', [1, 4]);
        diagnostics = await manager_1.default.getCurrentDiagnostics();
        expect(diagnostics.length).toBe(1);
        config.update('checkCurrentLine', true);
        await nvim.call('cursor', [1, 2]);
        diagnostics = await manager_1.default.getCurrentDiagnostics();
        expect(diagnostics.length).toBe(2);
        config.update('checkCurrentLine', false);
    });
    it('should jump to related position', async () => {
        let doc = await helper_1.default.createDocument();
        let range = vscode_languageserver_types_1.Range.create(0, 0, 0, 10);
        let location = vscode_languageserver_types_1.Location.create(vscode_uri_1.URI.file(__filename).toString(), range);
        let diagnostic = vscode_languageserver_types_1.Diagnostic.create(range, 'msg', vscode_languageserver_types_1.DiagnosticSeverity.Error, 1000, 'test', [{ location, message: 'test' }]);
        let collection = manager_1.default.create('positions');
        collection.set(doc.uri, [diagnostic]);
        await helper_1.default.wait(300);
        await manager_1.default.jumpRelated();
        let bufname = await nvim.call('bufname', '%');
        expect(bufname).toMatch('diagnosticManager');
    });
    it('should jump to previous', async () => {
        let doc = await createDocument();
        await nvim.command('normal! G$');
        let ranges = manager_1.default.getSortedRanges(doc.uri);
        ranges.reverse();
        for (let i = 0; i < ranges.length; i++) {
            await manager_1.default.jumpPrevious();
            let pos = await workspace_1.default.getCursorPosition();
            expect(pos).toEqual(ranges[i].start);
        }
    });
    it('should jump to next', async () => {
        let doc = await createDocument();
        await nvim.call('cursor', [0, 0]);
        let ranges = manager_1.default.getSortedRanges(doc.uri);
        for (let i = 0; i < ranges.length; i++) {
            await manager_1.default.jumpNext();
            let pos = await workspace_1.default.getCursorPosition();
            expect(pos).toEqual(ranges[i].start);
        }
    });
    it('should show floating window on cursor hold', async () => {
        let config = workspace_1.default.getConfiguration('diagnostic');
        config.update('messageTarget', 'float');
        await createDocument();
        await nvim.call('cursor', [1, 3]);
        await nvim.command('doautocmd CursorHold');
        let winid = await helper_1.default.waitFloat();
        let bufnr = await nvim.call('nvim_win_get_buf', winid);
        let buf = nvim.createBuffer(bufnr);
        let lines = await buf.lines;
        expect(lines.join('\n')).toMatch('error');
    });
    it('should echo messages on cursor hold', async () => {
        let config = workspace_1.default.getConfiguration('diagnostic');
        config.update('messageTarget', 'echo');
        await createDocument();
        await nvim.call('cursor', [1, 3]);
        await helper_1.default.wait(600);
        let line = await helper_1.default.getCmdline();
        expect(line).toMatch('error');
        config.update('messageTarget', 'float');
    });
    it('should show diagnostics of current line', async () => {
        let config = workspace_1.default.getConfiguration('diagnostic');
        config.update('checkCurrentLine', true);
        await createDocument();
        await nvim.call('cursor', [1, 1]);
        let winid = await helper_1.default.waitFloat();
        let bufnr = await nvim.call('nvim_win_get_buf', winid);
        let buf = nvim.createBuffer(bufnr);
        let lines = await buf.lines;
        expect(lines.length).toBe(3);
        config.update('checkCurrentLine', false);
    });
    it('should get severity level', () => {
        expect(util_1.severityLevel('hint')).toBe(vscode_languageserver_types_1.DiagnosticSeverity.Hint);
        expect(util_1.severityLevel('error')).toBe(vscode_languageserver_types_1.DiagnosticSeverity.Error);
        expect(util_1.severityLevel('warning')).toBe(vscode_languageserver_types_1.DiagnosticSeverity.Warning);
        expect(util_1.severityLevel('information')).toBe(vscode_languageserver_types_1.DiagnosticSeverity.Information);
        expect(util_1.severityLevel('')).toBe(vscode_languageserver_types_1.DiagnosticSeverity.Hint);
    });
    it('should get severity name', () => {
        expect(util_1.getNameFromSeverity(null)).toBe('CocError');
    });
    it('should filter diagnostics by level', async () => {
        helper_1.default.updateConfiguration('diagnostic.level', 'warning');
        let doc = await createDocument();
        let diagnostics = manager_1.default.getDiagnostics(doc.uri);
        for (let diagnostic of diagnostics) {
            expect(diagnostic.severity != vscode_languageserver_types_1.DiagnosticSeverity.Hint).toBe(true);
            expect(diagnostic.severity != vscode_languageserver_types_1.DiagnosticSeverity.Information).toBe(true);
        }
    });
    it('should get empty diagnostic at end of line', async () => {
        let doc = await helper_1.default.createDocument();
        await nvim.setLine('foo');
        doc.forceSync();
        await nvim.command('normal! $');
        let diagnostic = vscode_languageserver_types_1.Diagnostic.create(vscode_languageserver_types_1.Range.create(0, 3, 1, 0), 'error', vscode_languageserver_types_1.DiagnosticSeverity.Error);
        let collection = manager_1.default.create('empty');
        collection.set(doc.uri, [diagnostic]);
        let diagnostics = await manager_1.default.getCurrentDiagnostics();
        expect(diagnostics.length).toBeGreaterThanOrEqual(1);
        expect(diagnostics[0].message).toBe('error');
        collection.dispose();
    });
});
//# sourceMappingURL=diagnosticManager.test.js.map