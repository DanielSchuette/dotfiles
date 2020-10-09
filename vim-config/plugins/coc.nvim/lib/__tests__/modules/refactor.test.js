"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const fs_1 = tslib_1.__importDefault(require("fs"));
const vscode_uri_1 = require("vscode-uri");
const refactor_1 = tslib_1.__importDefault(require("../../handler/refactor"));
const helper_1 = tslib_1.__importStar(require("../helper"));
const vscode_languageserver_types_1 = require("vscode-languageserver-types");
let nvim;
let refactor;
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
describe('create', () => {
    it('should create from workspaceEdit', async () => {
        let changes = {
            [vscode_uri_1.URI.file(__filename).toString()]: [{
                    range: vscode_languageserver_types_1.Range.create(0, 0, 0, 6),
                    newText: ''
                }, {
                    range: vscode_languageserver_types_1.Range.create(1, 0, 1, 6),
                    newText: ''
                }]
        };
        let edit = { changes };
        let refactor = await refactor_1.default.createFromWorkspaceEdit(edit);
        let shown = await refactor.valid();
        expect(shown).toBe(true);
    });
    it('should create from locations', async () => {
        let uri = vscode_uri_1.URI.file(__filename).toString();
        let locations = [{
                uri,
                range: vscode_languageserver_types_1.Range.create(0, 0, 0, 6),
            }, {
                uri,
                range: vscode_languageserver_types_1.Range.create(1, 0, 1, 6),
            }];
        let refactor = await refactor_1.default.createFromLocations(locations);
        let shown = await refactor.valid();
        expect(shown).toBe(true);
    });
});
describe('onChange', () => {
    it('should ignore when change after range', async () => {
        let doc = await helper_1.default.createDocument();
        await doc.buffer.append(['foo', 'bar']);
        await refactor_1.default.createFromLocations([{ uri: doc.uri, range: vscode_languageserver_types_1.Range.create(0, 0, 0, 3) }]);
        let lines = await nvim.call('getline', [1, '$']);
        await doc.buffer.append(['def']);
        doc.forceSync();
        await helper_1.default.wait(30);
        let newLines = await nvim.call('getline', [1, '$']);
        expect(lines).toEqual(newLines);
    });
    it('should adjust when change before range', async () => {
        let doc = await helper_1.default.createDocument();
        await doc.buffer.append(['', '', '', '', 'foo', 'bar']);
        await helper_1.default.wait(50);
        doc.forceSync();
        let refactor = await refactor_1.default.createFromLocations([{ uri: doc.uri, range: vscode_languageserver_types_1.Range.create(4, 0, 4, 3) }]);
        await doc.buffer.setLines(['def'], { start: 0, end: 0, strictIndexing: false });
        doc.forceSync();
        await helper_1.default.wait(30);
        let fileRange = refactor.getFileRange(4);
        expect(fileRange.start).toBe(2);
        expect(fileRange.end).toBe(8);
    });
    it('should removed when lines empty', async () => {
        let doc = await helper_1.default.createDocument();
        await doc.buffer.append(['', '', '', '', 'foo', 'bar']);
        await helper_1.default.wait(50);
        doc.forceSync();
        await refactor_1.default.createFromLocations([{ uri: doc.uri, range: vscode_languageserver_types_1.Range.create(4, 0, 4, 3) }]);
        await doc.buffer.setLines([], { start: 0, end: -1, strictIndexing: false });
        doc.forceSync();
        await helper_1.default.wait(30);
        let lines = await nvim.call('getline', [1, '$']);
        expect(lines.length).toBe(3);
    });
    it('should change when liens changed', async () => {
        let doc = await helper_1.default.createDocument();
        await doc.buffer.append(['', '', '', '', 'foo', 'bar']);
        await helper_1.default.wait(50);
        doc.forceSync();
        await refactor_1.default.createFromLocations([{ uri: doc.uri, range: vscode_languageserver_types_1.Range.create(4, 0, 4, 3) }]);
        await doc.buffer.setLines(['def'], { start: 5, end: 6, strictIndexing: false });
        doc.forceSync();
        await helper_1.default.wait(30);
        let lines = await nvim.call('getline', [1, '$']);
        expect(lines[lines.length - 2]).toBe('def');
    });
});
describe('refactor#getFileChanges', () => {
    it('should get changes #1', async () => {
        let lines = `
Save current buffer to make changes
\u3000
\u3000
\u3000/a.ts
    })
  } `;
        let refactor = await refactor_1.default.createFromLines(lines.split('\n'));
        let changes = await refactor.getFileChanges();
        expect(changes).toEqual([{ lnum: 5, filepath: '/a.ts', lines: ['    })', '  } '] }]);
    });
    it('should get changes #2', async () => {
        let lines = `
\u3000/a.ts
    })
  } `;
        let refactor = await refactor_1.default.createFromLines(lines.split('\n'));
        let changes = await refactor.getFileChanges();
        expect(changes).toEqual([{ lnum: 2, filepath: '/a.ts', lines: ['    })', '  } '] }]);
    });
    it('should get changes #3', async () => {
        let lines = `
\u3000/a.ts
    })
  }
\u3000`;
        let refactor = await refactor_1.default.createFromLines(lines.split('\n'));
        let changes = await refactor.getFileChanges();
        expect(changes).toEqual([{ lnum: 2, filepath: '/a.ts', lines: ['    })', '  }'] }]);
    });
    it('should get changes #4', async () => {
        let lines = `
\u3000/a.ts
foo
\u3000/b.ts
bar
\u3000`;
        let refactor = await refactor_1.default.createFromLines(lines.split('\n'));
        let changes = await refactor.getFileChanges();
        expect(changes).toEqual([
            { filepath: '/a.ts', lnum: 2, lines: ['foo'] },
            { filepath: '/b.ts', lnum: 4, lines: ['bar'] }
        ]);
    });
});
describe('Refactor#createRefactorBuffer', () => {
    it('should create refactor buffer', async () => {
        let winid = await nvim.call('win_getid');
        await refactor.createRefactorBuffer();
        let curr = await nvim.call('win_getid');
        expect(curr).toBeGreaterThan(winid);
        expect(refactor.document).toBeDefined();
    });
    it('should jump to position by <CR>', async () => {
        await refactor.createRefactorBuffer();
        let fileItem = {
            filepath: __filename,
            ranges: [{ start: 10, end: 11 }, { start: 15, end: 20 }]
        };
        await refactor.addFileItems([fileItem]);
        await nvim.call('cursor', [5, 1]);
        await refactor.splitOpen();
        let line = await nvim.eval('line(".")');
        let bufname = await nvim.eval('bufname("%")');
        expect(bufname).toMatch('refactor.test.ts');
        expect(line).toBe(12);
    });
});
describe('Refactor#saveRefactor', () => {
    it('should adjust line ranges after change', async () => {
        let filename = await helper_1.createTmpFile('foo\n\nbar\n');
        let fileItem = {
            filepath: filename,
            ranges: [{ start: 0, end: 1 }, { start: 2, end: 3 }]
        };
        await refactor.createRefactorBuffer();
        await refactor.addFileItems([fileItem]);
        nvim.pauseNotification();
        nvim.call('setline', [5, ['xyz']], true);
        nvim.command('undojoin', true);
        nvim.call('append', [5, ['de']], true);
        nvim.command('undojoin', true);
        nvim.call('append', [8, ['bar']], true);
        await nvim.resumeNotification();
        await helper_1.default.wait(100);
        let res = await refactor.saveRefactor();
        expect(res).toBe(true);
        let content = fs_1.default.readFileSync(filename, 'utf8');
        expect(content).toBe('xyz\nde\n\nbar\nbar\n');
        await nvim.command('normal! u');
        res = await refactor.saveRefactor();
        expect(res).toBe(true);
        content = fs_1.default.readFileSync(filename, 'utf8');
        expect(content).toBe('foo\n\nbar\n');
    });
    it('should not save when no change made', async () => {
        await refactor.createRefactorBuffer();
        let fileItem = {
            filepath: __filename,
            ranges: [{ start: 10, end: 11 }, { start: 15, end: 20 }]
        };
        await refactor.addFileItems([fileItem]);
        let res = await refactor.saveRefactor();
        expect(res).toBe(false);
    });
    it('should sync buffer change to file', async () => {
        let doc = await helper_1.default.createDocument();
        await doc.buffer.replace(['foo', 'bar', 'line'], 0);
        await helper_1.default.wait(30);
        let filename = vscode_uri_1.URI.parse(doc.uri).fsPath;
        let fileItem = {
            filepath: filename,
            ranges: [{ start: 0, end: 2 }]
        };
        await refactor.createRefactorBuffer();
        await refactor.addFileItems([fileItem]);
        await nvim.call('setline', [5, 'changed']);
        let res = await refactor.saveRefactor();
        expect(res).toBe(true);
        expect(fs_1.default.existsSync(filename)).toBe(true);
        let content = fs_1.default.readFileSync(filename, 'utf8');
        let lines = content.split('\n');
        expect(lines).toEqual(['changed', 'bar', 'line', '']);
        fs_1.default.unlinkSync(filename);
    });
});
//# sourceMappingURL=refactor.test.js.map