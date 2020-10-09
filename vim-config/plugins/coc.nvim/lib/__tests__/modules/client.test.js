"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const helper_1 = tslib_1.__importDefault(require("../helper"));
let nvim;
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
describe('node client pauseNotification', () => {
    it('should work with notify & request', async () => {
        nvim.pauseNotification();
        nvim.call('setline', [1, 'foo'], true);
        nvim.call('append', [1, ['bar']], true);
        await nvim.resumeNotification(false, true);
        await helper_1.default.wait(500);
        let buffer = await nvim.buffer;
        let lines = await buffer.lines;
        expect(lines).toEqual(['foo', 'bar']);
        nvim.pauseNotification();
        nvim.call('eval', ['&buftype'], true);
        nvim.call('bufnr', ['%'], true);
        let res = await nvim.resumeNotification();
        expect(res).toEqual([['', buffer.id], null]);
    });
    it('should work with request during notification', async () => {
        let bufnr = await nvim.eval('bufnr("%")');
        nvim.pauseNotification();
        nvim.call('setline', [1, 'foo'], true);
        setTimeout(async () => {
            nvim.call('append', [1, ['bar']], true);
            await nvim.resumeNotification(false, true);
        }, 200);
        nvim.pauseNotification();
        nvim.call('bufnr', ['%'], true);
        let res = await nvim.resumeNotification();
        expect(res).toEqual([[bufnr], null]);
        await helper_1.default.wait(400);
    });
});
//# sourceMappingURL=client.test.js.map