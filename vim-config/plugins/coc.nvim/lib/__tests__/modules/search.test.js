"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const refactor_1 = tslib_1.__importDefault(require("../../handler/refactor"));
const search_1 = tslib_1.__importDefault(require("../../handler/search"));
const helper_1 = tslib_1.__importDefault(require("../helper"));
const path_1 = tslib_1.__importDefault(require("path"));
let nvim;
let refactor;
let cmd = path_1.default.resolve(__dirname, '../rg');
let cwd = process.cwd();
beforeAll(async () => {
    await helper_1.default.setup();
    nvim = helper_1.default.nvim;
});
beforeEach(async () => {
    refactor = new refactor_1.default();
});
afterAll(async () => {
    await helper_1.default.shutdown();
});
afterEach(async () => {
    if (refactor) {
        refactor.dispose();
    }
    await helper_1.default.reset();
});
describe('search', () => {
    it('should open refactor window', async () => {
        let search = new search_1.default(nvim, cmd);
        await refactor.createRefactorBuffer();
        await search.run([], cwd, refactor);
        let fileItems = refactor.fileItems;
        expect(fileItems.length).toBe(2);
        expect(fileItems[0].ranges.length).toBe(2);
    });
    it('should fail on invalid command', async () => {
        let search = new search_1.default(nvim, 'rrg');
        await refactor.createRefactorBuffer();
        let err;
        try {
            await search.run([], cwd, refactor);
        }
        catch (e) {
            err = e;
        }
        expect(err).toBeDefined();
    });
});
//# sourceMappingURL=search.test.js.map