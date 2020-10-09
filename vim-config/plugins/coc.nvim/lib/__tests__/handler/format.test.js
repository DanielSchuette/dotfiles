"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const workspace_1 = tslib_1.__importDefault(require("../../workspace"));
const languages_1 = tslib_1.__importDefault(require("../../languages"));
const helper_1 = tslib_1.__importDefault(require("../helper"));
const util_1 = require("../../util");
const vscode_languageserver_protocol_1 = require("vscode-languageserver-protocol");
let nvim;
let disposables = [];
beforeAll(async () => {
    let { configurations } = workspace_1.default;
    configurations.updateUserConfig({ 'coc.preferences.formatOnType': true });
    await helper_1.default.setup();
    nvim = helper_1.default.nvim;
});
afterAll(async () => {
    await helper_1.default.shutdown();
});
afterEach(async () => {
    await helper_1.default.reset();
    util_1.disposeAll(disposables);
    disposables = [];
});
describe('formatOnType', () => {
    it('should does format on type', async () => {
        disposables.push(languages_1.default.registerOnTypeFormattingEditProvider(['text'], {
            provideOnTypeFormattingEdits: () => {
                return [vscode_languageserver_protocol_1.TextEdit.insert(vscode_languageserver_protocol_1.Position.create(0, 0), '  ')];
            }
        }, ['|']));
        await helper_1.default.edit();
        await nvim.command('setf text');
        await nvim.input('i|');
        await helper_1.default.wait(100);
        let line = await nvim.line;
        expect(line).toBe('  |');
        let cursor = await workspace_1.default.getCursorPosition();
        expect(cursor).toEqual({ line: 0, character: 3 });
    });
    it('should adjust cursor after format on type', async () => {
        disposables.push(languages_1.default.registerOnTypeFormattingEditProvider(['text'], {
            provideOnTypeFormattingEdits: () => {
                return [
                    vscode_languageserver_protocol_1.TextEdit.insert(vscode_languageserver_protocol_1.Position.create(0, 0), '  '),
                    vscode_languageserver_protocol_1.TextEdit.insert(vscode_languageserver_protocol_1.Position.create(0, 2), 'end')
                ];
            }
        }, ['|']));
        await helper_1.default.edit();
        await nvim.command('setf text');
        await nvim.setLine('"');
        await nvim.input('i|');
        await helper_1.default.wait(100);
        let line = await nvim.line;
        expect(line).toBe('  |"end');
        let cursor = await workspace_1.default.getCursorPosition();
        expect(cursor).toEqual({ line: 0, character: 3 });
    });
});
//# sourceMappingURL=format.test.js.map