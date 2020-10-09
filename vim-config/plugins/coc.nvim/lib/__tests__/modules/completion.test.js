"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const vscode_languageserver_types_1 = require("vscode-languageserver-types");
const completion_1 = tslib_1.__importDefault(require("../../completion"));
const languages_1 = tslib_1.__importDefault(require("../../languages"));
const manager_1 = tslib_1.__importDefault(require("../../snippets/manager"));
const sources_1 = tslib_1.__importDefault(require("../../sources"));
const types_1 = require("../../types");
const util_1 = require("../../util");
const workspace_1 = tslib_1.__importDefault(require("../../workspace"));
const helper_1 = tslib_1.__importDefault(require("../helper"));
let nvim;
let disposables = [];
beforeAll(async () => {
    await helper_1.default.setup();
    nvim = helper_1.default.nvim;
});
beforeEach(async () => {
    disposables = [];
    await helper_1.default.createDocument();
    await nvim.call('feedkeys', [String.fromCharCode(27), 'in']);
});
afterAll(async () => {
    await helper_1.default.shutdown();
});
afterEach(async () => {
    util_1.disposeAll(disposables);
    await helper_1.default.reset();
});
describe('completion events', () => {
    it('should load preferences', () => {
        let minTriggerInputLength = completion_1.default.config.minTriggerInputLength;
        expect(minTriggerInputLength).toBe(1);
    });
    it('should reload preferences onChange', () => {
        let { configurations } = workspace_1.default;
        configurations.updateUserConfig({ 'suggest.maxCompleteItemCount': 30 });
        let snippetIndicator = completion_1.default.config.maxItemCount;
        expect(snippetIndicator).toBe(30);
    });
});
describe('completion start', () => {
    it('should deactivate on doComplete error', async () => {
        let fn = completion_1.default._doComplete;
        completion_1.default._doComplete = async () => {
            throw new Error('fake');
        };
        let option = await nvim.call('coc#util#get_complete_option');
        await completion_1.default.startCompletion(option);
        completion_1.default._doComplete = fn;
        expect(completion_1.default.isActivated).toBe(false);
    });
    it('should start completion', async () => {
        await nvim.setLine('foo football');
        await nvim.input('a');
        await nvim.call('cursor', [1, 2]);
        let option = await nvim.call('coc#util#get_complete_option');
        await completion_1.default.startCompletion(option);
        expect(completion_1.default.isActivated).toBe(true);
    });
    it('should show slow source', async () => {
        let source = {
            priority: 0,
            enable: true,
            name: 'slow',
            sourceType: types_1.SourceType.Service,
            triggerCharacters: ['.'],
            doComplete: (_opt) => new Promise(resolve => {
                setTimeout(() => {
                    resolve({ items: [{ word: 'foo' }, { word: 'bar' }] });
                }, 600);
            })
        };
        disposables.push(sources_1.default.addSource(source));
        await helper_1.default.edit();
        await nvim.input('i.');
        await helper_1.default.waitPopup();
        expect(completion_1.default.isActivated).toBe(true);
        let items = await helper_1.default.items();
        expect(items.length).toBe(2);
    });
});
describe('completion resumeCompletion', () => {
    it('should stop if no filtered items', async () => {
        await nvim.setLine('foo ');
        await helper_1.default.wait(50);
        await nvim.input('Af');
        await helper_1.default.waitPopup();
        expect(completion_1.default.isActivated).toBe(true);
        await nvim.input('d');
        await helper_1.default.wait(60);
        expect(completion_1.default.isActivated).toBe(false);
    });
    it('should deactivate without filtered items', async () => {
        await nvim.setLine('foo fbi ');
        await nvim.input('Af');
        await helper_1.default.waitPopup();
        await nvim.input('c');
        await helper_1.default.wait(100);
        let items = await helper_1.default.items();
        expect(items.length).toBe(0);
        expect(completion_1.default.isActivated).toBe(false);
    });
    it('should deactivate when insert space', async () => {
        let source = {
            priority: 0,
            enable: true,
            name: 'empty',
            sourceType: types_1.SourceType.Service,
            triggerCharacters: ['.'],
            doComplete: (_opt) => new Promise(resolve => {
                resolve({ items: [{ word: 'foo bar' }] });
            })
        };
        sources_1.default.addSource(source);
        await helper_1.default.edit();
        await nvim.input('i.');
        await helper_1.default.waitPopup();
        expect(completion_1.default.isActivated).toBe(true);
        sources_1.default.removeSource(source);
        let items = await helper_1.default.items();
        expect(items[0].word).toBe('foo bar');
        await nvim.input(' ');
        await helper_1.default.wait(60);
        expect(completion_1.default.isActivated).toBe(false);
    });
    it('should use resume input to filter', async () => {
        let source = {
            priority: 0,
            enable: true,
            name: 'source',
            sourceType: types_1.SourceType.Service,
            triggerCharacters: ['.'],
            doComplete: () => new Promise(resolve => {
                setTimeout(() => {
                    resolve({ items: [{ word: 'foo' }, { word: 'bar' }] });
                }, 60);
            })
        };
        sources_1.default.addSource(source);
        await helper_1.default.edit();
        await nvim.input('i.');
        await helper_1.default.wait(20);
        await nvim.input('f');
        await helper_1.default.waitPopup();
        expect(completion_1.default.isActivated).toBe(true);
        let items = await helper_1.default.items();
        expect(items.length).toBe(1);
        expect(items[0].word).toBe('foo');
        sources_1.default.removeSource(source);
    });
    it('should filter slow source', async () => {
        let source = {
            priority: 0,
            enable: true,
            name: 'slow',
            sourceType: types_1.SourceType.Service,
            triggerCharacters: ['.'],
            doComplete: () => new Promise(resolve => {
                setTimeout(() => {
                    resolve({ items: [{ word: 'foo' }, { word: 'bar' }] });
                }, 600);
            })
        };
        disposables.push(sources_1.default.addSource(source));
        await helper_1.default.edit();
        await nvim.input('i.');
        await helper_1.default.wait(60);
        await nvim.input('f');
        await helper_1.default.waitPopup();
        await nvim.input('o');
        await helper_1.default.wait(100);
        expect(completion_1.default.isActivated).toBe(true);
        let items = await helper_1.default.items();
        expect(items.length).toBe(1);
        expect(items[0].word).toBe('foo');
    });
    it('should complete inComplete source', async () => {
        let source = {
            priority: 0,
            enable: true,
            name: 'inComplete',
            sourceType: types_1.SourceType.Service,
            triggerCharacters: ['.'],
            doComplete: async (opt) => {
                await helper_1.default.wait(30);
                if (opt.input.length <= 1) {
                    return { isIncomplete: true, items: [{ word: 'foo' }, { word: opt.input }] };
                }
                return { isIncomplete: false, items: [{ word: 'foo' }, { word: opt.input }] };
            }
        };
        disposables.push(sources_1.default.addSource(source));
        await helper_1.default.edit();
        await nvim.input('i.');
        await helper_1.default.waitPopup();
        expect(completion_1.default.isActivated).toBe(true);
        await nvim.input('a');
        await helper_1.default.wait(30);
        await nvim.input('b');
        await helper_1.default.wait(100);
    });
    it('should not complete inComplete source when isIncomplete is false', async () => {
        await helper_1.default.createDocument();
        let lastOption;
        let source = {
            priority: 0,
            enable: true,
            name: 'inComplete',
            sourceType: types_1.SourceType.Service,
            triggerCharacters: ['.'],
            doComplete: async (opt) => {
                lastOption = opt;
                await helper_1.default.wait(30);
                if (opt.input.length <= 1) {
                    return { isIncomplete: true, items: [{ word: 'foobar' }] };
                }
                return { isIncomplete: false, items: [{ word: 'foobar' }] };
            }
        };
        disposables.push(sources_1.default.addSource(source));
        await helper_1.default.edit();
        await nvim.input('i.');
        await helper_1.default.waitPopup();
        expect(completion_1.default.isActivated).toBe(true);
        await nvim.input('fo');
        await helper_1.default.wait(100);
        await nvim.input('b');
        await helper_1.default.wait(200);
        expect(completion_1.default.isActivated).toBe(true);
    });
});
describe('completion InsertEnter', () => {
    it('should trigger completion if triggerAfterInsertEnter is true', async () => {
        await helper_1.default.createDocument();
        await nvim.setLine('foo fo');
        let config = workspace_1.default.getConfiguration('suggest');
        config.update('triggerAfterInsertEnter', true);
        await helper_1.default.wait(100);
        let triggerAfterInsertEnter = completion_1.default.config.triggerAfterInsertEnter;
        expect(triggerAfterInsertEnter).toBe(true);
        await nvim.input('A');
        await helper_1.default.waitPopup();
        expect(completion_1.default.isActivated).toBe(true);
        config.update('triggerAfterInsertEnter', undefined);
    });
    it('should not trigger when input length too small', async () => {
        let config = workspace_1.default.getConfiguration('suggest');
        config.update('triggerAfterInsertEnter', true);
        await helper_1.default.wait(100);
        let triggerAfterInsertEnter = completion_1.default.config.triggerAfterInsertEnter;
        expect(triggerAfterInsertEnter).toBe(true);
        await nvim.setLine('foo ');
        await nvim.input('A');
        await helper_1.default.wait(100);
        expect(completion_1.default.isActivated).toBe(false);
        config.update('triggerAfterInsertEnter', undefined);
    });
});
describe('completion TextChangedP', () => {
    it('should stop when input length below option input length', async () => {
        await helper_1.default.edit();
        await nvim.setLine('foo fbi ');
        await nvim.input('Af');
        await helper_1.default.waitPopup();
        await nvim.input('<backspace>');
        await helper_1.default.wait(100);
        expect(completion_1.default.isActivated).toBe(false);
    });
    it('should fix cursor position with plain text on additionalTextEdits', async () => {
        let provider = {
            provideCompletionItems: async () => [{
                    label: 'foo',
                    filterText: 'foo',
                    additionalTextEdits: [vscode_languageserver_types_1.TextEdit.insert(vscode_languageserver_types_1.Position.create(0, 0), 'a\nbar')]
                }]
        };
        disposables.push(languages_1.default.registerCompletionItemProvider('edits', 'edit', null, provider));
        await nvim.input('if');
        await helper_1.default.waitPopup();
        await helper_1.default.selectCompleteItem(0);
        await helper_1.default.wait(200);
        let line = await nvim.line;
        expect(line).toBe('barfoo');
        let [, lnum, col] = await nvim.call('getcurpos');
        expect(lnum).toBe(2);
        expect(col).toBe(7);
    });
    it('should filter in complete request', async () => {
        let provider = {
            provideCompletionItems: async (doc, pos, token, context) => {
                let option = context.option;
                if (context.triggerCharacter == '.') {
                    return {
                        isIncomplete: true,
                        items: [
                            {
                                label: 'foo'
                            }, {
                                label: 'bar'
                            }
                        ]
                    };
                }
                if (option.input == 'f') {
                    await helper_1.default.wait(100);
                    if (token.isCancellationRequested)
                        return;
                    return {
                        isIncomplete: true,
                        items: [
                            {
                                label: 'foo'
                            }
                        ]
                    };
                }
                if (option.input == 'fo') {
                    await helper_1.default.wait(100);
                    if (token.isCancellationRequested)
                        return;
                    return {
                        isIncomplete: false,
                        items: [
                            {
                                label: 'foo'
                            }
                        ]
                    };
                }
            }
        };
        disposables.push(languages_1.default.registerCompletionItemProvider('edits', 'edit', null, provider, ['.']));
        await nvim.input('i.');
        await helper_1.default.waitPopup();
        await nvim.input('f');
        await helper_1.default.wait(60);
        await nvim.input('o');
        await helper_1.default.wait(300);
        let res = await helper_1.default.getItems();
        expect(res.length).toBe(1);
    });
    it('should provide word when textEdit after startcol', async () => {
        // some LS would send textEdit after first character,
        // need fix the word from newText
        let provider = {
            provideCompletionItems: async (_, position) => {
                if (position.line != 0)
                    return null;
                return [{
                        label: 'bar',
                        filterText: 'ar',
                        textEdit: {
                            range: vscode_languageserver_types_1.Range.create(0, 1, 0, 1),
                            newText: 'ar'
                        }
                    }];
            }
        };
        disposables.push(languages_1.default.registerCompletionItemProvider('edits', 'edit', null, provider));
        await nvim.input('ib');
        await helper_1.default.waitPopup();
        let context = await nvim.getVar('coc#_context');
        expect(context.start).toBe(1);
        expect(context.candidates[0].word).toBe('ar');
    });
    it('should adjust completion position by textEdit start position', async () => {
        let provider = {
            provideCompletionItems: async (_document, _position, _token, context) => {
                if (!context.triggerCharacter)
                    return;
                return [{
                        label: 'foo',
                        textEdit: {
                            range: vscode_languageserver_types_1.Range.create(0, 0, 0, 1),
                            newText: '?foo'
                        }
                    }];
            }
        };
        disposables.push(languages_1.default.registerCompletionItemProvider('fix', 'f', null, provider, ['?']));
        await nvim.input('i?');
        await helper_1.default.waitPopup();
        await nvim.eval('feedkeys("\\<C-n>", "in")');
        await helper_1.default.wait(200);
        let line = await nvim.line;
        expect(line).toBe('?foo');
    });
    it('should fix cursor position with snippet on additionalTextEdits', async () => {
        await helper_1.default.createDocument();
        let provider = {
            provideCompletionItems: async () => [{
                    label: 'if',
                    insertTextFormat: vscode_languageserver_types_1.InsertTextFormat.Snippet,
                    textEdit: { range: vscode_languageserver_types_1.Range.create(0, 0, 0, 2), newText: 'if($1)' },
                    additionalTextEdits: [vscode_languageserver_types_1.TextEdit.insert(vscode_languageserver_types_1.Position.create(0, 0), 'bar ')],
                    preselect: true
                }]
        };
        disposables.push(languages_1.default.registerCompletionItemProvider('edits', 'edit', null, provider));
        await nvim.input('ii');
        await helper_1.default.waitPopup();
        let res = await helper_1.default.getItems();
        let idx = res.findIndex(o => o.menu == '[edit]');
        await helper_1.default.selectCompleteItem(idx);
        await helper_1.default.wait(800);
        let line = await nvim.line;
        expect(line).toBe('bar if()');
        let [, lnum, col] = await nvim.call('getcurpos');
        expect(lnum).toBe(1);
        expect(col).toBe(8);
    });
    it('should fix cursor position with plain text snippet on additionalTextEdits', async () => {
        let provider = {
            provideCompletionItems: async () => [{
                    label: 'if',
                    insertTextFormat: vscode_languageserver_types_1.InsertTextFormat.Snippet,
                    textEdit: { range: vscode_languageserver_types_1.Range.create(0, 0, 0, 2), newText: 'do$0' },
                    additionalTextEdits: [vscode_languageserver_types_1.TextEdit.insert(vscode_languageserver_types_1.Position.create(0, 0), 'bar ')],
                    preselect: true
                }]
        };
        disposables.push(languages_1.default.registerCompletionItemProvider('edits', 'edit', null, provider));
        await nvim.input('iif');
        await helper_1.default.waitPopup();
        await helper_1.default.selectCompleteItem(0);
        await helper_1.default.wait(200);
        let line = await nvim.line;
        let [, lnum, col] = await nvim.call('getcurpos');
        expect(line).toBe('bar do');
        expect(lnum).toBe(1);
        expect(col).toBe(7);
    });
    it('should fix cursor position with nested snippet on additionalTextEdits', async () => {
        await helper_1.default.createDocument();
        let res = await manager_1.default.insertSnippet('func($1)$0');
        expect(res).toBe(true);
        let provider = {
            provideCompletionItems: async () => [{
                    label: 'if',
                    insertTextFormat: vscode_languageserver_types_1.InsertTextFormat.Snippet,
                    insertText: 'do$0',
                    additionalTextEdits: [vscode_languageserver_types_1.TextEdit.insert(vscode_languageserver_types_1.Position.create(0, 0), 'bar ')],
                    preselect: true
                }]
        };
        disposables.push(languages_1.default.registerCompletionItemProvider('edits', 'edit', null, provider));
        await nvim.input('if');
        await helper_1.default.waitPopup();
        await helper_1.default.selectCompleteItem(0);
        await helper_1.default.wait(200);
        let line = await nvim.line;
        let [, lnum, col] = await nvim.call('getcurpos');
        expect(line).toBe('bar func(do)');
        expect(lnum).toBe(1);
        expect(col).toBe(12);
    });
    it('should fix input for snippet item', async () => {
        let provider = {
            provideCompletionItems: async () => [{
                    label: 'foo',
                    filterText: 'foo',
                    insertText: '${1:foo}($2)',
                    insertTextFormat: vscode_languageserver_types_1.InsertTextFormat.Snippet,
                }]
        };
        disposables.push(languages_1.default.registerCompletionItemProvider('snippets-test', 'st', null, provider));
        await nvim.input('if');
        await helper_1.default.waitPopup();
        await nvim.input('<C-n>');
        await helper_1.default.wait(100);
        let line = await nvim.line;
        expect(line).toBe('foo');
    });
    it('should filter on none keyword input', async () => {
        let source = {
            priority: 99,
            enable: true,
            name: 'temp',
            sourceType: types_1.SourceType.Service,
            doComplete: (_opt) => Promise.resolve({ items: [{ word: 'foo#abc' }] }),
        };
        disposables.push(sources_1.default.addSource(source));
        await nvim.input('if');
        await helper_1.default.waitPopup();
        await nvim.input('#');
        await helper_1.default.wait(100);
        let items = await helper_1.default.getItems();
        expect(items[0].word).toBe('foo#abc');
    });
    it('should use source-provided score', async () => {
        let source = {
            priority: 0,
            enable: true,
            name: 'source',
            sourceType: types_1.SourceType.Service,
            doComplete: (_opt) => Promise.resolve({
                items: [
                    { word: 'candidate_a', sourceScore: 0.1 },
                    { word: 'candidate_b', sourceScore: 10 },
                    { word: 'candidate_c' },
                ]
            }),
        };
        disposables.push(sources_1.default.addSource(source));
        await nvim.input('ocand');
        await helper_1.default.waitPopup();
        let items = await helper_1.default.getItems();
        expect(items[0].word).toBe('candidate_b');
        expect(items[1].word).toBe('candidate_c');
        expect(items[2].word).toBe('candidate_a');
    });
    it('should do resolve for complete item', async () => {
        let source = {
            priority: 0,
            enable: true,
            name: 'resolve',
            sourceType: types_1.SourceType.Service,
            triggerCharacters: ['.'],
            doComplete: (_opt) => Promise.resolve({ items: [{ word: 'foo' }] }),
            onCompleteResolve: item => {
                item.info = 'detail';
            }
        };
        sources_1.default.addSource(source);
        await nvim.input('i.');
        await helper_1.default.waitPopup();
        await helper_1.default.wait(100);
        await nvim.input('<C-n>');
        await helper_1.default.wait(100);
        // let items = completion.completeItems
        // expect(items[0].info).toBe('detail')
        sources_1.default.removeSource(source);
    });
});
describe('completion done', () => {
    it('should fix word on CompleteDone', async () => {
        await nvim.setLine('fball football');
        await nvim.input('i');
        await nvim.call('cursor', [1, 2]);
        let option = await nvim.call('coc#util#get_complete_option');
        await completion_1.default.startCompletion(option);
        let items = await helper_1.default.items();
        expect(items.length).toBe(1);
        await nvim.input('<C-n>');
        await helper_1.default.wait(30);
        await nvim.call('coc#_select');
        await helper_1.default.wait(100);
        let line = await nvim.line;
        expect(line).toBe('football football');
    });
});
describe('completion option', () => {
    it('should hide kind and menu when configured', async () => {
        helper_1.default.updateConfiguration('suggest.disableKind', true);
        helper_1.default.updateConfiguration('suggest.disableMenu', true);
        await nvim.setLine('fball football');
        await nvim.input('of');
        await helper_1.default.waitPopup();
        let items = await helper_1.default.getItems();
        expect(items[0].kind).toBeUndefined();
        expect(items[0].menu).toBeUndefined();
        helper_1.default.updateConfiguration('suggest.disableKind', false);
        helper_1.default.updateConfiguration('suggest.disableMenu', false);
    });
});
describe('completion TextChangedI', () => {
    it('should respect commitCharacter on TextChangedI', async () => {
        let source = {
            priority: 0,
            enable: true,
            name: 'slow',
            sourceType: types_1.SourceType.Service,
            triggerCharacters: ['.'],
            doComplete: (opt) => {
                if (opt.triggerCharacter == '.') {
                    return Promise.resolve({ items: [{ word: 'bar' }] });
                }
                return Promise.resolve({ items: [{ word: 'foo' }] });
            },
            shouldCommit: (_item, character) => character == '.'
        };
        sources_1.default.addSource(source);
        await nvim.input('if');
        await helper_1.default.pumvisible();
        await helper_1.default.wait(100);
        await nvim.input('.');
        await helper_1.default.wait(100);
        sources_1.default.removeSource(source);
    });
    it('should cancel completion when for same pretext', async () => {
        await nvim.setLine('foo');
        await nvim.input('of');
        await helper_1.default.pumvisible();
        await helper_1.default.wait(10);
        await nvim.call('coc#_cancel', []);
        await helper_1.default.wait(10);
        expect(completion_1.default.isActivated).toBe(false);
    });
});
describe('completion trigger', () => {
    it('should trigger completion on type trigger character', async () => {
        let source = {
            priority: 1,
            enable: true,
            name: 'trigger',
            sourceType: types_1.SourceType.Service,
            triggerCharacters: ['.'],
            doComplete: (opt) => {
                if (opt.triggerCharacter == '.') {
                    return Promise.resolve({ items: [{ word: 'bar' }] });
                }
                return Promise.resolve({ items: [{ word: 'foo#bar' }] });
            }
        };
        sources_1.default.addSource(source);
        await nvim.input('i');
        await helper_1.default.wait(30);
        await nvim.input('.');
        await helper_1.default.waitPopup();
        let items = await helper_1.default.items();
        expect(items.length).toBeGreaterThan(0);
        sources_1.default.removeSource(source);
    });
    it('should not trigger if autoTrigger is none', async () => {
        let config = workspace_1.default.getConfiguration('suggest');
        config.update('autoTrigger', 'none');
        let autoTrigger = completion_1.default.config.autoTrigger;
        expect(autoTrigger).toBe('none');
        await nvim.setLine('foo fo');
        await nvim.input('A');
        await helper_1.default.wait(100);
        expect(completion_1.default.isActivated).toBe(false);
        config.update('autoTrigger', 'always');
    });
    it('should trigger complete on trigger patterns match', async () => {
        let source = {
            priority: 99,
            enable: true,
            name: 'temp',
            triggerPatterns: [/EM/],
            sourceType: types_1.SourceType.Service,
            doComplete: (opt) => {
                if (!opt.input.startsWith('EM'))
                    return null;
                return Promise.resolve({
                    items: [
                        { word: 'foo', filterText: 'EMfoo' },
                        { word: 'bar', filterText: 'EMbar' }
                    ]
                });
            },
        };
        disposables.push(sources_1.default.addSource(source));
        await nvim.input('i');
        await nvim.input('EM');
        await helper_1.default.waitPopup();
        let items = await helper_1.default.getItems();
        expect(items.length).toBe(2);
    });
    it('should trigger complete when pumvisible and triggerPatterns match', async () => {
        await nvim.setLine('EnumMember');
        let source = {
            priority: 99,
            enable: true,
            name: 'temp',
            triggerPatterns: [/EM/],
            sourceType: types_1.SourceType.Service,
            doComplete: (opt) => {
                if (!opt.input.startsWith('EM'))
                    return null;
                return Promise.resolve({
                    items: [
                        { word: 'a', filterText: 'EMa' },
                        { word: 'b', filterText: 'EMb' }
                    ]
                });
            },
        };
        disposables.push(sources_1.default.addSource(source));
        await nvim.input('o');
        await helper_1.default.wait(10);
        await nvim.input('E');
        await helper_1.default.wait(30);
        await nvim.input('M');
        await helper_1.default.waitPopup();
        let items = await helper_1.default.getItems();
        expect(items.length).toBeGreaterThan(2);
    });
});
//# sourceMappingURL=completion.test.js.map