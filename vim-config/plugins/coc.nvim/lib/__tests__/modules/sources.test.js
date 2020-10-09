"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const path_1 = tslib_1.__importDefault(require("path"));
const events_1 = tslib_1.__importDefault(require("../../events"));
const sources_1 = tslib_1.__importDefault(require("../../sources"));
const types_1 = require("../../types");
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
describe('sources', () => {
    it('should do document enter', async () => {
        let fn = jest.fn();
        let source = {
            name: 'enter',
            enable: true,
            priority: 0,
            sourceType: types_1.SourceType.Service,
            triggerCharacters: [],
            doComplete: () => Promise.resolve({ items: [] }),
            onEnter: fn
        };
        sources_1.default.addSource(source);
        let buffer = await nvim.buffer;
        await events_1.default.fire('BufEnter', [buffer.id]);
        expect(fn).toBeCalled();
        sources_1.default.removeSource(source);
    });
    it('should return source states', () => {
        let stats = sources_1.default.sourceStats();
        expect(stats.length > 1).toBe(true);
    });
    it('should toggle source state', () => {
        sources_1.default.toggleSource('around');
        let s = sources_1.default.getSource('around');
        expect(s.enable).toBe(false);
        sources_1.default.toggleSource('around');
    });
    it('should disable source by coc_sources_disable_map', async () => {
        await nvim.command('let g:coc_sources_disable_map = {"python": ["around", "buffer"]}');
        let res = sources_1.default.getNormalSources('python');
        await nvim.command('let g:coc_sources_disable_map = {}');
        expect(res.find(o => o.name == 'around')).toBeUndefined();
        expect(res.find(o => o.name == 'buffer')).toBeUndefined();
    });
});
describe('sources#has', () => {
    it('should has source', () => {
        expect(sources_1.default.has('around')).toBe(true);
    });
    it('should not has source', () => {
        expect(sources_1.default.has('NotExists')).toBe(false);
    });
});
describe('sources#refresh', () => {
    it('should refresh if possible', async () => {
        let fn = jest.fn();
        let source = {
            name: 'refresh',
            enable: true,
            priority: 0,
            sourceType: types_1.SourceType.Service,
            triggerCharacters: [],
            doComplete: () => Promise.resolve({ items: [] }),
            refresh: fn
        };
        sources_1.default.addSource(source);
        await sources_1.default.refresh('refresh');
        expect(fn).toBeCalled();
        sources_1.default.removeSource(source);
    });
    it('should work if refresh not defined', async () => {
        let source = {
            name: 'refresh',
            enable: true,
            priority: 0,
            sourceType: types_1.SourceType.Service,
            triggerCharacters: [],
            doComplete: () => Promise.resolve({ items: [] })
        };
        sources_1.default.addSource(source);
        await sources_1.default.refresh('refresh');
        sources_1.default.removeSource(source);
    });
});
describe('sources#createSource', () => {
    it('should create source', async () => {
        let disposable = sources_1.default.createSource({
            name: 'custom',
            doComplete: () => Promise.resolve({
                items: [{
                        word: 'custom'
                    }]
            })
        });
        await helper_1.default.createDocument();
        await nvim.input('i');
        await helper_1.default.wait(30);
        await nvim.input('c');
        let visible = await helper_1.default.visible('custom', 'custom');
        expect(visible).toBe(true);
        disposable.dispose();
    });
    it('should create vim source', async () => {
        let folder = path_1.default.resolve(__dirname, '..');
        await nvim.command(`set runtimepath+=${folder}`);
        await helper_1.default.wait(100);
        let exists = sources_1.default.has('email');
        expect(exists).toBe(true);
        await helper_1.default.createDocument();
        await nvim.input('i');
        await helper_1.default.wait(10);
        await nvim.input('@');
        await helper_1.default.visible('foo@gmail.com');
    });
});
//# sourceMappingURL=sources.test.js.map