"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const vscode_languageserver_types_1 = require("vscode-languageserver-types");
const cursors_1 = tslib_1.__importDefault(require("../../cursors"));
const helper_1 = tslib_1.__importDefault(require("../helper"));
let nvim;
let cursors;
beforeAll(async () => {
    await helper_1.default.setup();
    nvim = helper_1.default.nvim;
    cursors = new cursors_1.default(nvim);
});
afterAll(async () => {
    await helper_1.default.shutdown();
});
afterEach(async () => {
    nvim.pauseNotification();
    cursors.cancel();
    await nvim.resumeNotification();
    await helper_1.default.reset();
});
function rangeCount() {
    return cursors.ranges.length;
}
describe('cursors#select', () => {
    it('should select by position', async () => {
        let doc = await helper_1.default.createDocument();
        await nvim.call('setline', [1, ['a', 'b']]);
        await nvim.call('cursor', [1, 1]);
        await helper_1.default.wait(100);
        doc.forceSync();
        await helper_1.default.wait(100);
        await cursors.select(doc.bufnr, 'position', 'n');
        await helper_1.default.wait(30);
        let n = rangeCount();
        expect(n).toBe(1);
        await nvim.setOption('virtualedit', 'onemore');
        await nvim.call('cursor', [2, 2]);
        await cursors.select(doc.bufnr, 'position', 'n');
        n = rangeCount();
        expect(n).toBe(2);
        await cursors.select(doc.bufnr, 'position', 'n');
        n = rangeCount();
        expect(n).toBe(1);
    });
    it('should select by word', async () => {
        let doc = await helper_1.default.createDocument();
        await nvim.call('setline', [1, ['foo', 'bar']]);
        await nvim.call('cursor', [1, 1]);
        await helper_1.default.wait(30);
        doc.forceSync();
        await cursors.select(doc.bufnr, 'word', 'n');
        let n = rangeCount();
        expect(n).toBe(1);
        await nvim.call('cursor', [2, 2]);
        await cursors.select(doc.bufnr, 'word', 'n');
        n = rangeCount();
        expect(n).toBe(2);
        await cursors.select(doc.bufnr, 'word', 'n');
        n = rangeCount();
        expect(n).toBe(1);
    });
    it('should select last character', async () => {
        let doc = await helper_1.default.createDocument();
        await nvim.setOption('virtualedit', 'onemore');
        await nvim.call('setline', [1, ['}', '{']]);
        await nvim.call('cursor', [1, 2]);
        await helper_1.default.wait(30);
        doc.forceSync();
        await cursors.select(doc.bufnr, 'word', 'n');
        let n = rangeCount();
        expect(n).toBe(1);
        await nvim.call('cursor', [2, 1]);
        await helper_1.default.wait(30);
        doc.forceSync();
        await cursors.select(doc.bufnr, 'word', 'n');
        n = rangeCount();
        expect(n).toBe(2);
    });
    it('should select by visual range', async () => {
        let doc = await helper_1.default.createDocument();
        await nvim.call('setline', [1, ['"foo"', '"bar"']]);
        await nvim.call('cursor', [1, 1]);
        await nvim.command('normal! vE');
        await helper_1.default.wait(30);
        doc.forceSync();
        await cursors.select(doc.bufnr, 'range', 'v');
        let n = rangeCount();
        expect(n).toBe(1);
        await nvim.call('cursor', [2, 1]);
        await nvim.command('normal! vE');
        await cursors.select(doc.bufnr, 'range', 'v');
        n = rangeCount();
        expect(n).toBe(2);
        await cursors.select(doc.bufnr, 'range', 'v');
        n = rangeCount();
        expect(n).toBe(1);
    });
    it('should select by operator', async () => {
        await nvim.command('nmap x  <Plug>(coc-cursors-operator)');
        await helper_1.default.createDocument();
        await nvim.call('setline', [1, ['"short"', '"long"']]);
        await nvim.call('cursor', [1, 2]);
        await nvim.input('xa"');
        await helper_1.default.wait(30);
        await nvim.call('cursor', [2, 2]);
        await nvim.input('xa"');
        await helper_1.default.wait(30);
        await nvim.command('nunmap x');
    });
});
describe('cursors#addRanges', () => {
    it('should add ranges', async () => {
        let doc = await helper_1.default.createDocument();
        await nvim.call('setline', [1, ['foo foo foo', 'bar bar']]);
        await helper_1.default.wait(30);
        doc.forceSync();
        let ranges = [
            vscode_languageserver_types_1.Range.create(0, 0, 0, 3),
            vscode_languageserver_types_1.Range.create(0, 4, 0, 7),
            vscode_languageserver_types_1.Range.create(0, 8, 0, 11),
            vscode_languageserver_types_1.Range.create(1, 0, 1, 3),
            vscode_languageserver_types_1.Range.create(1, 4, 1, 7)
        ];
        await cursors.addRanges(ranges);
        let n = rangeCount();
        expect(n).toBe(5);
    });
});
describe('cursors#onchange', () => {
    async function setup() {
        let doc = await helper_1.default.createDocument();
        await nvim.call('setline', [1, ['foo foo foo', 'bar bar']]);
        await helper_1.default.wait(30);
        doc.forceSync();
        let ranges = [
            vscode_languageserver_types_1.Range.create(0, 0, 0, 3),
            vscode_languageserver_types_1.Range.create(0, 4, 0, 7),
            vscode_languageserver_types_1.Range.create(0, 8, 0, 11),
            vscode_languageserver_types_1.Range.create(1, 0, 1, 3),
            vscode_languageserver_types_1.Range.create(1, 4, 1, 7)
        ];
        await cursors.addRanges(ranges);
        await nvim.call('cursor', [1, 1]);
        return doc;
    }
    it('should ignore change after last range', async () => {
        let doc = await setup();
        await doc.buffer.append(['append']);
        doc.forceSync();
        await helper_1.default.wait(50);
        let n = rangeCount();
        expect(n).toBe(5);
    });
    it('should adjust ranges on change before first line', async () => {
        let doc = await setup();
        await doc.buffer.setLines(['prepend'], { start: 0, end: 0, strictIndexing: false });
        doc.forceSync();
        await helper_1.default.wait(200);
        let n = rangeCount();
        expect(n).toBe(5);
        await nvim.call('cursor', [2, 1]);
        await nvim.input('ia');
        await helper_1.default.wait(100);
        doc.forceSync();
        await helper_1.default.wait(100);
        let lines = await nvim.call('getline', [1, '$']);
        expect(lines).toEqual(['prepend', 'afoo afoo afoo', 'abar abar']);
    });
    it('should work when change made to unrelated line', async () => {
        let doc = await setup();
        await doc.buffer.setLines(['prepend'], { start: 0, end: 0, strictIndexing: false });
        doc.forceSync();
        await helper_1.default.wait(200);
        let n = rangeCount();
        expect(n).toBe(5);
        await nvim.call('cursor', [1, 1]);
        await nvim.input('ia');
        await helper_1.default.wait(200);
        doc.forceSync();
        await helper_1.default.wait(100);
        await nvim.call('cursor', [2, 1]);
        await nvim.input('a');
        await helper_1.default.wait(200);
        doc.forceSync();
        await helper_1.default.wait(200);
        let lines = await nvim.call('getline', [1, '$']);
        expect(lines).toEqual(['aprepend', 'afoo afoo afoo', 'abar abar']);
    });
    it('should add text before', async () => {
        let doc = await setup();
        await nvim.input('iabc');
        await helper_1.default.wait(30);
        doc.forceSync();
        await helper_1.default.wait(100);
        let lines = await nvim.call('getline', [1, '$']);
        expect(lines).toEqual(['abcfoo abcfoo abcfoo', 'abcbar abcbar']);
    });
    it('should add text after', async () => {
        let doc = await setup();
        await nvim.call('cursor', [1, 4]);
        await nvim.input('iabc');
        await helper_1.default.wait(30);
        doc.forceSync();
        await helper_1.default.wait(100);
        let lines = await nvim.call('getline', [1, '$']);
        expect(lines).toEqual(['fooabc fooabc fooabc', 'barabc barabc']);
    });
    it('should add text around', async () => {
        let doc = await setup();
        await nvim.setLine('"foo" foo foo');
        await helper_1.default.wait(30);
        doc.forceSync();
        await helper_1.default.wait(100);
        let lines = await nvim.call('getline', [1, '$']);
        expect(lines).toEqual(['"foo" "foo" "foo"', '"bar" "bar"']);
    });
    it('should remove text before', async () => {
        let doc = await setup();
        await nvim.command('normal! x');
        doc.forceSync();
        await helper_1.default.wait(100);
        let lines = await nvim.call('getline', [1, '$']);
        expect(lines).toEqual(['oo oo oo', 'ar ar']);
    });
    it('should remove text middle', async () => {
        let doc = await setup();
        await nvim.call('cursor', [2, 2]);
        await nvim.command('normal! x');
        doc.forceSync();
        await helper_1.default.wait(100);
        let lines = await nvim.call('getline', [1, '$']);
        expect(lines).toEqual(['fo fo fo', 'br br']);
    });
    it('should remove text after', async () => {
        let doc = await setup();
        await nvim.call('cursor', [1, 3]);
        await nvim.command('normal! x');
        doc.forceSync();
        await helper_1.default.wait(100);
        let lines = await nvim.call('getline', [1, '$']);
        expect(lines).toEqual(['fo fo fo', 'ba ba']);
    });
    it('should remove text around', async () => {
        let doc = await helper_1.default.createDocument();
        await nvim.call('setline', [1, ['"foo" "bar"']]);
        await helper_1.default.wait(30);
        doc.forceSync();
        let ranges = [
            vscode_languageserver_types_1.Range.create(0, 0, 0, 5),
            vscode_languageserver_types_1.Range.create(0, 6, 0, 11)
        ];
        await cursors.addRanges(ranges);
        await nvim.call('cursor', [1, 2]);
        await nvim.setLine('foo "bar"');
        doc.forceSync();
        await helper_1.default.wait(100);
        let lines = await nvim.call('getline', [1, '$']);
        expect(lines).toEqual(['foo bar']);
    });
    it('should replace text before', async () => {
        let doc = await setup();
        await nvim.call('cursor', [1, 1]);
        await nvim.command('normal! ra');
        doc.forceSync();
        await helper_1.default.wait(100);
        let lines = await nvim.call('getline', [1, '$']);
        expect(lines).toEqual(['aoo aoo aoo', 'aar aar']);
    });
    it('should replace text after', async () => {
        let doc = await setup();
        await nvim.call('cursor', [1, 3]);
        await nvim.command('normal! ra');
        doc.forceSync();
        await helper_1.default.wait(100);
        let lines = await nvim.call('getline', [1, '$']);
        expect(lines).toEqual(['foa foa foa', 'baa baa']);
    });
    it('should replace text middle', async () => {
        let doc = await setup();
        await nvim.call('cursor', [1, 2]);
        await nvim.input('sab');
        await helper_1.default.wait(30);
        doc.forceSync();
        await helper_1.default.wait(100);
        let lines = await nvim.call('getline', [1, '$']);
        expect(lines).toEqual(['fabo fabo fabo', 'babr babr']);
    });
    it('should adjust undo & redo on add & remove', async () => {
        let doc = await setup();
        await nvim.call('cursor', [1, 4]);
        await nvim.input('iabc');
        await helper_1.default.wait(30);
        doc.forceSync();
        expect(rangeCount()).toBe(5);
        await helper_1.default.wait(30);
        await nvim.command('undo');
        await helper_1.default.wait(30);
        doc.forceSync();
        expect(rangeCount()).toBe(5);
        await helper_1.default.wait(30);
        await nvim.command('redo');
        await helper_1.default.wait(30);
        doc.forceSync();
        expect(rangeCount()).toBe(5);
        let lines = await nvim.call('getline', [1, '$']);
        expect(lines).toEqual(['fooabc fooabc fooabc', 'barabc barabc']);
    });
    it('should adjust undo & redo on change around', async () => {
        let doc = await setup();
        await nvim.setLine('"foo" foo foo');
        await helper_1.default.wait(30);
        doc.forceSync();
        expect(rangeCount()).toBe(5);
        await helper_1.default.wait(30);
        await nvim.command('undo');
        await helper_1.default.wait(30);
        doc.forceSync();
        expect(rangeCount()).toBe(5);
        await helper_1.default.wait(30);
        await nvim.command('redo');
        await helper_1.default.wait(30);
        doc.forceSync();
        expect(rangeCount()).toBe(5);
        let lines = await nvim.call('getline', [1, '$']);
        expect(lines).toEqual(['"foo" "foo" "foo"', '"bar" "bar"']);
    });
});
describe('cursors#keymaps', () => {
    async function setup() {
        let doc = await helper_1.default.createDocument();
        await nvim.call('setline', [1, ['a', 'b', 'c']]);
        await helper_1.default.wait(30);
        doc.forceSync();
        await nvim.call('cursor', [1, 1]);
        await cursors.select(doc.bufnr, 'position', 'n');
        await helper_1.default.wait(30);
        await nvim.call('cursor', [2, 1]);
        await cursors.select(doc.bufnr, 'position', 'n');
        await helper_1.default.wait(30);
        await nvim.call('cursor', [3, 1]);
        await cursors.select(doc.bufnr, 'position', 'n');
    }
    async function hasKeymap(key) {
        let buf = await nvim.buffer;
        let keymaps = await buf.getKeymap('n');
        return keymaps.find(o => o.lhs == key) != null;
    }
    it('should setup cancel keymap', async () => {
        await setup();
        let count = rangeCount();
        expect(count).toBe(3);
        await nvim.input('<esc>');
        await helper_1.default.wait(100);
        count = rangeCount();
        expect(count).toBe(0);
        let has = await hasKeymap('<Esc>');
        expect(has).toBe(true);
        await nvim.input('<esc>');
        await helper_1.default.wait(100);
        has = await hasKeymap('<Esc>');
        expect(has).toBe(false);
    });
    it('should setup nextKey', async () => {
        await setup();
        await nvim.input('<C-n>');
        await helper_1.default.wait(50);
        let cursor = await nvim.call('coc#util#cursor');
        expect(cursor).toEqual([0, 0]);
        await nvim.input('<C-n>');
        await helper_1.default.wait(50);
        cursor = await nvim.call('coc#util#cursor');
        expect(cursor).toEqual([1, 0]);
    });
    it('should setup previouskey', async () => {
        await setup();
        await nvim.input('<C-p>');
        await helper_1.default.wait(50);
        let cursor = await nvim.call('coc#util#cursor');
        expect(cursor).toEqual([1, 0]);
        await nvim.input('<C-p>');
        await helper_1.default.wait(50);
        cursor = await nvim.call('coc#util#cursor');
        expect(cursor).toEqual([0, 0]);
    });
});
//# sourceMappingURL=cursors.test.js.map