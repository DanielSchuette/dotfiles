"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const mru_1 = tslib_1.__importDefault(require("../../model/mru"));
const os_1 = tslib_1.__importDefault(require("os"));
const fs_1 = tslib_1.__importDefault(require("fs"));
const path_1 = tslib_1.__importDefault(require("path"));
const root = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), 'coc-mru-'));
describe('Mru', () => {
    it('should load items', async () => {
        let mru = new mru_1.default('test', root);
        await mru.clean();
        let res = await mru.load();
        expect(res.length).toBe(0);
    });
    it('should add items', async () => {
        let mru = new mru_1.default('test', root);
        await mru.add('a');
        await mru.add('b');
        let res = await mru.load();
        expect(res.length).toBe(2);
        await mru.clean();
    });
    it('should remove item', async () => {
        let mru = new mru_1.default('test', root);
        await mru.add('a');
        await mru.remove('a');
        let res = await mru.load();
        expect(res.length).toBe(0);
        await mru.clean();
    });
});
//# sourceMappingURL=mru.test.js.map