"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const helper_1 = tslib_1.__importDefault(require("../helper"));
const terminal_1 = tslib_1.__importDefault(require("../../model/terminal"));
let nvim;
let terminal;
beforeAll(async () => {
    await helper_1.default.setup();
    nvim = helper_1.default.nvim;
    terminal = new terminal_1.default('sh', [], nvim);
    await terminal.start(__dirname, { COC_TERMINAL: `option '-term'` });
});
afterAll(async () => {
    terminal.dispose();
    await helper_1.default.shutdown();
});
describe('terminal properties', () => {
    it('should get name', () => {
        let name = terminal.name;
        expect(name).toBe('sh');
    });
    it('should have correct cwd and env', async () => {
        let bufnr = terminal.bufnr;
        terminal.sendText('echo $PWD');
        await helper_1.default.wait(300);
        let lines = await nvim.call('getbufline', [bufnr, 1, '$']);
        expect(lines.includes(__dirname)).toBe(true);
        terminal.sendText('echo $COC_TERMINAL');
        await helper_1.default.wait(300);
        lines = await nvim.call('getbufline', [bufnr, 1, '$']);
        expect(lines.includes(`option '-term'`)).toBe(true);
    });
    it('should get pid', async () => {
        let pid = await terminal.processId;
        expect(typeof pid).toBe('number');
    });
    it('should hide terminal window', async () => {
        await terminal.hide();
        let winnr = await nvim.call('bufwinnr', terminal.bufnr);
        expect(winnr).toBe(-1);
    });
    it('should show terminal window', async () => {
        await terminal.show();
        let winnr = await nvim.call('bufwinnr', terminal.bufnr);
        expect(winnr != -1).toBe(true);
    });
});
//# sourceMappingURL=terminal.test.js.map