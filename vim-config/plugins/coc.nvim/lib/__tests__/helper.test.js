"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const helper_1 = tslib_1.__importDefault(require("./helper"));
let nvim;
let plugin;
beforeAll(async () => {
    await helper_1.default.setup();
    nvim = helper_1.default.nvim;
    plugin = helper_1.default.plugin;
});
describe('Helper', () => {
    it('should setup', () => {
        expect(nvim).toBeTruthy();
        expect(plugin.isReady).toBeTruthy();
    });
});
afterAll(async () => {
    await helper_1.default.shutdown();
});
//# sourceMappingURL=helper.test.js.map