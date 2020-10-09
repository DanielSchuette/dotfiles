"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const floatFactory_1 = tslib_1.__importDefault(require("../../model/floatFactory"));
const manager_1 = tslib_1.__importDefault(require("../../snippets/manager"));
const workspace_1 = tslib_1.__importDefault(require("../../workspace"));
const helper_1 = tslib_1.__importDefault(require("../helper"));
let nvim;
let floatFactory;
beforeAll(async () => {
    await helper_1.default.setup();
    nvim = helper_1.default.nvim;
    floatFactory = new floatFactory_1.default(nvim, workspace_1.default.env, false, 8);
});
afterAll(async () => {
    await helper_1.default.shutdown();
    floatFactory.dispose();
});
afterEach(async () => {
    await helper_1.default.reset();
});
describe('FloatFactory', () => {
    it('should create', async () => {
        let docs = [{
                filetype: 'markdown',
                content: 'f'.repeat(81)
            }];
        let called = false;
        let fn = (winid, bufnr) => {
            called = true;
            expect(floatFactory.bufnr).toBe(bufnr);
            expect(floatFactory.window.id).toBe(winid);
        };
        floatFactory.on('show', fn);
        await floatFactory.create(docs);
        let hasFloat = await nvim.call('coc#util#has_float');
        expect(hasFloat).toBe(1);
        await nvim.call('coc#util#float_hide');
        floatFactory.removeListener('show', fn);
        expect(called).toBe(true);
    });
    it('should hide on BufEnter', async () => {
        await helper_1.default.edit();
        let docs = [{
                filetype: 'markdown',
                content: 'foo'
            }];
        await floatFactory.create(docs);
        await nvim.command(`edit foo`);
        await helper_1.default.wait(100);
        let hasFloat = await nvim.call('coc#util#has_float');
        expect(hasFloat).toBe(0);
    });
    it('should hide on CursorMoved', async () => {
        await helper_1.default.edit();
        await nvim.setLine('foo');
        let docs = [{
                filetype: 'markdown',
                content: 'foo'
            }];
        await floatFactory.create(docs);
        let hasFloat = await nvim.call('coc#util#has_float');
        expect(hasFloat).toBe(1);
        await helper_1.default.wait(30);
        await nvim.input('$');
        await helper_1.default.wait(500);
        hasFloat = await nvim.call('coc#util#has_float');
        expect(hasFloat).toBe(0);
    });
    it('should not hide when cursor position not changed', async () => {
        await helper_1.default.edit();
        await nvim.setLine('foo');
        let cursor = await nvim.eval("[line('.'), col('.')]");
        let docs = [{
                filetype: 'markdown',
                content: 'foo'
            }];
        await floatFactory.create(docs);
        await nvim.call('cursor', [1, 2]);
        await helper_1.default.wait(10);
        await nvim.call('cursor', cursor);
        await helper_1.default.wait(300);
        let hasFloat = await nvim.call('coc#util#has_float');
        expect(hasFloat).toBe(1);
    });
    it('should show only one window', async () => {
        await helper_1.default.edit();
        await nvim.setLine('foo');
        let docs = [{
                filetype: 'markdown',
                content: 'foo'
            }];
        await Promise.all([
            floatFactory.create(docs),
            floatFactory.create(docs)
        ]);
        await helper_1.default.wait(30);
        let count = 0;
        let wins = await nvim.windows;
        for (let win of wins) {
            let isFloat = await win.getVar('float');
            if (isFloat)
                count++;
        }
        expect(count).toBe(1);
    });
    it('should allow select mode', async () => {
        await helper_1.default.createDocument();
        await manager_1.default.insertSnippet('${1:foo}');
        let docs = [{
                filetype: 'markdown',
                content: 'foo'
            }];
        await floatFactory.create(docs, true);
        let { mode } = await nvim.mode;
        expect(mode).toBe('s');
    });
    it('should get active state of window', async () => {
        let docs = [{
                filetype: 'markdown',
                content: 'f'.repeat(81)
            }];
        await floatFactory.create(docs);
        let res = await floatFactory.activated();
        expect(res).toBe(true);
        await nvim.call('coc#util#float_hide');
        res = await floatFactory.activated();
        expect(res).toBe(false);
    });
});
//# sourceMappingURL=floatFactory.test.js.map