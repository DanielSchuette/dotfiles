"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const vscode_languageserver_protocol_1 = require("vscode-languageserver-protocol");
const vscode_uri_1 = require("vscode-uri");
const commands_1 = tslib_1.__importDefault(require("../commands"));
const manager_1 = tslib_1.__importDefault(require("../diagnostic/manager"));
const events_1 = tslib_1.__importDefault(require("../events"));
const languages_1 = tslib_1.__importDefault(require("../languages"));
const manager_2 = tslib_1.__importDefault(require("../list/manager"));
const floatFactory_1 = tslib_1.__importDefault(require("../model/floatFactory"));
const services_1 = tslib_1.__importDefault(require("../services"));
const manager_3 = tslib_1.__importDefault(require("../snippets/manager"));
const util_1 = require("../util");
const convert_1 = require("../util/convert");
const object_1 = require("../util/object");
const position_1 = require("../util/position");
const string_1 = require("../util/string");
const workspace_1 = tslib_1.__importDefault(require("../workspace"));
const codelens_1 = tslib_1.__importDefault(require("./codelens"));
const colors_1 = tslib_1.__importDefault(require("./colors"));
const documentHighlight_1 = tslib_1.__importDefault(require("./documentHighlight"));
const refactor_1 = tslib_1.__importDefault(require("./refactor"));
const search_1 = tslib_1.__importDefault(require("./search"));
const logger = require('../util/logger')('Handler');
const pairs = new Map([
    ['<', '>'],
    ['>', '<'],
    ['{', '}'],
    ['[', ']'],
    ['(', ')'],
]);
class Handler {
    constructor(nvim) {
        this.nvim = nvim;
        this.refactorMap = new Map();
        this.documentLines = [];
        this.disposables = [];
        this.labels = {};
        this.selectionRange = null;
        this.symbolsTokenSources = new Map();
        this.cachedSymbols = new Map();
        this.getPreferences();
        this.requestStatusItem = workspace_1.default.createStatusBarItem(0, { progress: true });
        workspace_1.default.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('coc.preferences')) {
                this.getPreferences();
            }
        });
        this.hoverFactory = new floatFactory_1.default(nvim, workspace_1.default.env);
        this.disposables.push(this.hoverFactory);
        let { signaturePreferAbove, signatureFloatMaxWidth, signatureMaxHeight } = this.preferences;
        this.signatureFactory = new floatFactory_1.default(nvim, workspace_1.default.env, signaturePreferAbove, signatureMaxHeight, signatureFloatMaxWidth, false);
        this.disposables.push(this.signatureFactory);
        workspace_1.default.onWillSaveUntil(event => {
            let { languageId } = event.document;
            let config = workspace_1.default.getConfiguration('coc.preferences', event.document.uri);
            let filetypes = config.get('formatOnSaveFiletypes', []);
            if (filetypes.includes(languageId) || filetypes.some(item => item === '*')) {
                let willSaveWaitUntil = async () => {
                    let options = await workspace_1.default.getFormatOptions(event.document.uri);
                    let tokenSource = new vscode_languageserver_protocol_1.CancellationTokenSource();
                    let timer = setTimeout(() => {
                        tokenSource.cancel();
                    }, 1000);
                    let textEdits = await languages_1.default.provideDocumentFormattingEdits(event.document, options, tokenSource.token);
                    clearTimeout(timer);
                    return textEdits;
                };
                event.waitUntil(willSaveWaitUntil());
            }
        }, null, 'languageserver');
        events_1.default.on('BufUnload', async (bufnr) => {
            let refactor = this.refactorMap.get(bufnr);
            if (refactor) {
                refactor.dispose();
                this.refactorMap.delete(bufnr);
            }
        }, null, this.disposables);
        events_1.default.on(['CursorMoved', 'InsertEnter'], () => {
            if (this.requestTokenSource) {
                this.requestTokenSource.cancel();
            }
        }, null, this.disposables);
        events_1.default.on('CursorMovedI', async (bufnr, cursor) => {
            if (!this.signaturePosition)
                return;
            let doc = workspace_1.default.getDocument(bufnr);
            if (!doc)
                return;
            let { line, character } = this.signaturePosition;
            if (cursor[0] - 1 == line) {
                let currline = doc.getline(cursor[0] - 1);
                let col = string_1.byteLength(currline.slice(0, character)) + 1;
                if (cursor[1] >= col)
                    return;
            }
            this.signatureFactory.close();
        }, null, this.disposables);
        events_1.default.on('InsertLeave', () => {
            this.signatureFactory.close();
        }, null, this.disposables);
        events_1.default.on(['TextChangedI', 'TextChangedP'], async () => {
            if (this.preferences.signatureHideOnChange) {
                this.signatureFactory.close();
            }
            this.hoverFactory.close();
        }, null, this.disposables);
        let lastInsert;
        events_1.default.on('InsertCharPre', async (character) => {
            lastInsert = Date.now();
            if (character == ')')
                this.signatureFactory.close();
        }, null, this.disposables);
        events_1.default.on('Enter', async (bufnr) => {
            let { bracketEnterImprove } = this.preferences;
            await this.tryFormatOnType('\n', bufnr);
            if (bracketEnterImprove) {
                let line = await nvim.call('line', '.') - 1;
                let doc = workspace_1.default.getDocument(bufnr);
                if (!doc)
                    return;
                await doc.checkDocument();
                let pre = doc.getline(line - 1);
                let curr = doc.getline(line);
                let prevChar = pre[pre.length - 1];
                if (prevChar && pairs.has(prevChar)) {
                    let nextChar = curr.trim()[0];
                    if (nextChar && pairs.get(prevChar) == nextChar) {
                        let edits = [];
                        let opts = await workspace_1.default.getFormatOptions(doc.uri);
                        let space = opts.insertSpaces ? ' '.repeat(opts.tabSize) : '\t';
                        let preIndent = pre.match(/^\s*/)[0];
                        let currIndent = curr.match(/^\s*/)[0];
                        let newText = '\n' + preIndent + space;
                        let pos = vscode_languageserver_protocol_1.Position.create(line - 1, pre.length);
                        // make sure indent of current line
                        if (preIndent != currIndent) {
                            let newText = doc.filetype == 'vim' ? '  \\ ' + preIndent : preIndent;
                            edits.push({ range: vscode_languageserver_protocol_1.Range.create(vscode_languageserver_protocol_1.Position.create(line, 0), vscode_languageserver_protocol_1.Position.create(line, currIndent.length)), newText });
                        }
                        else if (doc.filetype == 'vim') {
                            edits.push({ range: vscode_languageserver_protocol_1.Range.create(line, currIndent.length, line, currIndent.length), newText: '  \\ ' });
                        }
                        if (doc.filetype == 'vim') {
                            newText = newText + '\\ ';
                        }
                        edits.push({ range: vscode_languageserver_protocol_1.Range.create(pos, pos), newText });
                        await doc.applyEdits(edits);
                        await workspace_1.default.moveTo(vscode_languageserver_protocol_1.Position.create(line, newText.length - 1));
                    }
                }
            }
        }, null, this.disposables);
        events_1.default.on('TextChangedI', async (bufnr) => {
            let curr = Date.now();
            if (!lastInsert || curr - lastInsert > 300)
                return;
            lastInsert = null;
            let doc = workspace_1.default.getDocument(bufnr);
            if (!doc || doc.isCommandLine || !doc.attached)
                return;
            let { triggerSignatureHelp, formatOnType } = this.preferences;
            if (!triggerSignatureHelp && !formatOnType)
                return;
            let [pos, line] = await nvim.eval('[coc#util#cursor(), getline(".")]');
            let pre = pos[1] == 0 ? '' : line.slice(pos[1] - 1, pos[1]);
            if (!pre || string_1.isWord(pre))
                return;
            await this.tryFormatOnType(pre, bufnr);
            if (triggerSignatureHelp && languages_1.default.shouldTriggerSignatureHelp(doc.textDocument, pre)) {
                try {
                    let [mode, cursor] = await nvim.eval('[mode(),coc#util#cursor()]');
                    if (mode !== 'i')
                        return;
                    await this.triggerSignatureHelp(doc, { line: cursor[0], character: cursor[1] });
                }
                catch (e) {
                    logger.error(`Error on signature help:`, e);
                }
            }
        }, null, this.disposables);
        events_1.default.on('InsertLeave', async (bufnr) => {
            if (!this.preferences.formatOnInsertLeave)
                return;
            await util_1.wait(30);
            if (workspace_1.default.insertMode)
                return;
            await this.tryFormatOnType('\n', bufnr, true);
        }, null, this.disposables);
        if (this.preferences.currentFunctionSymbolAutoUpdate) {
            events_1.default.on('CursorHold', () => {
                this.getCurrentFunctionSymbol().logError();
            }, null, this.disposables);
        }
        let provider = {
            onDidChange: null,
            provideTextDocumentContent: async () => {
                nvim.pauseNotification();
                nvim.command('setlocal conceallevel=2 nospell nofoldenable wrap', true);
                nvim.command('setlocal bufhidden=wipe nobuflisted', true);
                nvim.command('setfiletype markdown', true);
                nvim.command(`if winnr('j') != winnr('k') | exe "normal! z${Math.min(this.documentLines.length, this.preferences.previewMaxHeight)}\\<cr> | endif"`, true);
                await nvim.resumeNotification();
                return this.documentLines.join('\n');
            }
        };
        this.disposables.push(workspace_1.default.registerTextDocumentContentProvider('coc', provider));
        this.codeLensManager = new codelens_1.default(nvim);
        this.colors = new colors_1.default(nvim);
        this.documentHighlighter = new documentHighlight_1.default(nvim, this.colors);
        this.disposables.push(commands_1.default.registerCommand('editor.action.organizeImport', async (bufnr) => {
            if (!bufnr)
                bufnr = await nvim.call('bufnr', '%');
            let doc = workspace_1.default.getDocument(bufnr);
            if (!doc || !doc.attached)
                return false;
            await synchronizeDocument(doc);
            let actions = await this.getCodeActions(doc, undefined, [vscode_languageserver_protocol_1.CodeActionKind.SourceOrganizeImports]);
            if (actions && actions.length) {
                await this.applyCodeAction(actions[0]);
                return true;
            }
            workspace_1.default.showMessage(`Organize import action not found.`, 'warning');
            return false;
        }));
        commands_1.default.titles.set('editor.action.organizeImport', 'run organize import code action.');
    }
    async withRequestToken(name, fn, checkEmpty) {
        if (this.requestTokenSource) {
            this.requestTokenSource.cancel();
            this.requestTokenSource.dispose();
        }
        if (this.requestTimer) {
            clearTimeout(this.requestTimer);
        }
        let statusItem = this.requestStatusItem;
        this.requestTokenSource = new vscode_languageserver_protocol_1.CancellationTokenSource();
        let { token } = this.requestTokenSource;
        token.onCancellationRequested(() => {
            statusItem.text = `${name} request canceled`;
            statusItem.isProgress = false;
            this.requestTimer = setTimeout(() => {
                statusItem.hide();
            }, 500);
        });
        statusItem.isProgress = true;
        statusItem.text = `requesting ${name}`;
        statusItem.show();
        let res;
        try {
            res = await Promise.resolve(fn(token));
        }
        catch (e) {
            workspace_1.default.showMessage(e.message, 'error');
            logger.error(`Error on ${name}`, e);
        }
        if (this.requestTokenSource) {
            this.requestTokenSource.dispose();
            this.requestTokenSource = undefined;
        }
        if (token.isCancellationRequested)
            return null;
        statusItem.hide();
        if (res == null) {
            logger.warn(`${name} provider not found!`);
        }
        else if (checkEmpty && Array.isArray(res) && res.length == 0) {
            workspace_1.default.showMessage(`${name} not found`, 'warning');
            return null;
        }
        return res;
    }
    async getCurrentFunctionSymbol() {
        let { doc, position } = await this.getCurrentState();
        if (!doc)
            return '';
        let symbols = await this.getDocumentSymbols(doc);
        if (!symbols || symbols.length === 0) {
            doc.buffer.setVar('coc_current_function', '', true);
            this.nvim.call('coc#util#do_autocmd', ['CocStatusChange'], true);
            return '';
        }
        symbols = symbols.filter(s => [
            'Class',
            'Method',
            'Function',
            'Struct',
        ].includes(s.kind));
        let functionName = '';
        for (let sym of symbols.reverse()) {
            if (sym.range
                && position_1.positionInRange(position, sym.range) == 0
                && !sym.text.endsWith(') callback')) {
                functionName = sym.text;
                let label = this.labels[sym.kind.toLowerCase()];
                if (label)
                    functionName = `${label} ${functionName}`;
                break;
            }
        }
        doc.buffer.setVar('coc_current_function', functionName, true);
        this.nvim.call('coc#util#do_autocmd', ['CocStatusChange'], true);
        return functionName;
    }
    async hasProvider(id) {
        let bufnr = await this.nvim.call('bufnr', '%');
        let doc = workspace_1.default.getDocument(bufnr);
        if (!doc)
            return false;
        return languages_1.default.hasProvider(id, doc.textDocument);
    }
    async onHover() {
        let { doc, position, winid } = await this.getCurrentState();
        if (doc == null)
            return;
        let target = this.preferences.hoverTarget;
        if (target == 'float') {
            this.hoverFactory.close();
        }
        else if (target == 'preview') {
            this.nvim.command('pclose', true);
        }
        await synchronizeDocument(doc);
        let hovers = await this.withRequestToken('hover', token => {
            return languages_1.default.getHover(doc.textDocument, position, token);
        }, true);
        if (hovers == null)
            return false;
        let hover = hovers.find(o => vscode_languageserver_protocol_1.Range.is(o.range));
        if (hover) {
            doc.matchAddRanges([hover.range], 'CocHoverRange', 999);
            setTimeout(() => {
                this.nvim.call('coc#util#clear_pos_matches', ['^CocHoverRange', winid], true);
                if (workspace_1.default.isVim)
                    this.nvim.command('redraw', true);
            }, 1000);
        }
        await this.previewHover(hovers);
        return true;
    }
    async gotoDefinition(openCommand) {
        let { doc, position } = await this.getCurrentState();
        if (doc == null)
            return false;
        await synchronizeDocument(doc);
        let definition = await this.withRequestToken('definition', token => {
            return languages_1.default.getDefinition(doc.textDocument, position, token);
        }, true);
        if (definition == null)
            return false;
        await this.handleLocations(definition, openCommand);
        return true;
    }
    async gotoDeclaration(openCommand) {
        let { doc, position } = await this.getCurrentState();
        if (doc == null)
            return false;
        await synchronizeDocument(doc);
        let definition = await this.withRequestToken('declaration', token => {
            return languages_1.default.getDeclaration(doc.textDocument, position, token);
        }, true);
        if (definition == null)
            return false;
        await this.handleLocations(definition, openCommand);
        return true;
    }
    async gotoTypeDefinition(openCommand) {
        let { doc, position } = await this.getCurrentState();
        if (doc == null)
            return false;
        await synchronizeDocument(doc);
        let definition = await this.withRequestToken('type definition', token => {
            return languages_1.default.getTypeDefinition(doc.textDocument, position, token);
        }, true);
        if (definition == null)
            return false;
        await this.handleLocations(definition, openCommand);
        return true;
    }
    async gotoImplementation(openCommand) {
        let { doc, position } = await this.getCurrentState();
        if (doc == null)
            return false;
        await synchronizeDocument(doc);
        let definition = await this.withRequestToken('implementation', token => {
            return languages_1.default.getImplementation(doc.textDocument, position, token);
        }, true);
        if (definition == null)
            return false;
        await this.handleLocations(definition, openCommand);
        return true;
    }
    async gotoReferences(openCommand, includeDeclaration = true) {
        let { doc, position } = await this.getCurrentState();
        if (doc == null)
            return false;
        await synchronizeDocument(doc);
        let definition = await this.withRequestToken('references', token => {
            return languages_1.default.getReferences(doc.textDocument, { includeDeclaration }, position, token);
        }, true);
        if (definition == null)
            return false;
        await this.handleLocations(definition, openCommand);
        return true;
    }
    async getDocumentSymbols(doc) {
        var _a;
        if (!doc || !doc.attached)
            return [];
        await synchronizeDocument(doc);
        let cached = this.cachedSymbols.get(doc.bufnr);
        if (cached && cached[0] == doc.version) {
            return cached[1];
        }
        (_a = this.symbolsTokenSources.get(doc.bufnr)) === null || _a === void 0 ? void 0 : _a.cancel();
        let tokenSource = new vscode_languageserver_protocol_1.CancellationTokenSource();
        this.symbolsTokenSources.set(doc.bufnr, tokenSource);
        let { version } = doc;
        let symbols = await languages_1.default.getDocumentSymbol(doc.textDocument, tokenSource.token);
        this.symbolsTokenSources.delete(doc.bufnr);
        if (!symbols || symbols.length == 0)
            return null;
        let level = 0;
        let res = [];
        let pre = null;
        if (isDocumentSymbols(symbols)) {
            symbols.sort(sortDocumentSymbols);
            symbols.forEach(s => addDoucmentSymbol(res, s, level));
        }
        else {
            symbols.sort(sortSymbolInformations);
            for (let sym of symbols) {
                let { name, kind, location, containerName } = sym;
                if (!containerName || !pre) {
                    level = 0;
                }
                else {
                    if (pre.containerName == containerName) {
                        level = pre.level || 0;
                    }
                    else {
                        let container = getPreviousContainer(containerName, res);
                        level = container ? container.level + 1 : 0;
                    }
                }
                let { start } = location.range;
                let o = {
                    col: start.character + 1,
                    lnum: start.line + 1,
                    text: name,
                    level,
                    kind: convert_1.getSymbolKind(kind),
                    range: location.range,
                    containerName
                };
                res.push(o);
                pre = o;
            }
        }
        this.cachedSymbols.set(doc.bufnr, [version, res]);
        return res;
    }
    async getWordEdit() {
        let { doc, position } = await this.getCurrentState();
        if (doc == null)
            return null;
        let range = doc.getWordRangeAtPosition(position);
        if (!range || position_1.emptyRange(range))
            return null;
        let curname = doc.textDocument.getText(range);
        if (languages_1.default.hasProvider('rename', doc.textDocument)) {
            await synchronizeDocument(doc);
            let requestTokenSource = new vscode_languageserver_protocol_1.CancellationTokenSource();
            let res = await languages_1.default.prepareRename(doc.textDocument, position, requestTokenSource.token);
            if (res === false)
                return null;
            let edit = await languages_1.default.provideRenameEdits(doc.textDocument, position, curname, requestTokenSource.token);
            if (edit)
                return edit;
        }
        workspace_1.default.showMessage('Rename provider not found, extract word ranges from current buffer', 'more');
        let ranges = doc.getSymbolRanges(curname);
        return {
            changes: {
                [doc.uri]: ranges.map(r => ({ range: r, newText: curname }))
            }
        };
    }
    async rename(newName) {
        let { doc, position } = await this.getCurrentState();
        if (doc == null)
            return false;
        let { nvim } = this;
        if (!languages_1.default.hasProvider('rename', doc.textDocument)) {
            workspace_1.default.showMessage(`Rename provider not found for current document`, 'warning');
            return false;
        }
        await synchronizeDocument(doc);
        let statusItem = this.requestStatusItem;
        try {
            let token = (new vscode_languageserver_protocol_1.CancellationTokenSource()).token;
            let res = await languages_1.default.prepareRename(doc.textDocument, position, token);
            if (res === false) {
                statusItem.hide();
                workspace_1.default.showMessage('Invalid position for rename', 'warning');
                return false;
            }
            if (token.isCancellationRequested)
                return false;
            let curname;
            if (!newName) {
                if (vscode_languageserver_protocol_1.Range.is(res)) {
                    curname = doc.textDocument.getText(res);
                }
                else if (res && typeof res.placeholder === 'string') {
                    curname = res.placeholder;
                }
                else {
                    curname = await nvim.eval('expand("<cword>")');
                }
                newName = await workspace_1.default.requestInput('New name', curname);
            }
            if (!newName) {
                statusItem.hide();
                return false;
            }
            let edit = await languages_1.default.provideRenameEdits(doc.textDocument, position, newName, token);
            if (token.isCancellationRequested)
                return false;
            statusItem.hide();
            if (!edit) {
                workspace_1.default.showMessage('Invalid position for rename', 'warning');
                return false;
            }
            await workspace_1.default.applyEdit(edit);
            return true;
        }
        catch (e) {
            statusItem.hide();
            workspace_1.default.showMessage(`Error on rename: ${e.message}`, 'error');
            logger.error(e);
            return false;
        }
    }
    async documentFormatting() {
        let { doc } = await this.getCurrentState();
        if (doc == null)
            return false;
        await synchronizeDocument(doc);
        let options = await workspace_1.default.getFormatOptions(doc.uri);
        let textEdits = await this.withRequestToken('format', token => {
            return languages_1.default.provideDocumentFormattingEdits(doc.textDocument, options, token);
        });
        if (textEdits && textEdits.length > 0) {
            await doc.applyEdits(textEdits);
            return true;
        }
        return false;
    }
    async documentRangeFormatting(mode) {
        let { doc } = await this.getCurrentState();
        if (doc == null)
            return -1;
        await synchronizeDocument(doc);
        let range;
        if (mode) {
            range = await workspace_1.default.getSelectedRange(mode, doc);
            if (!range)
                return -1;
        }
        else {
            let [lnum, count, mode] = await this.nvim.eval("[v:lnum,v:count,mode()]");
            // we can't handle
            if (count == 0 || mode == 'i' || mode == 'R')
                return -1;
            range = vscode_languageserver_protocol_1.Range.create(lnum - 1, 0, lnum - 1 + count, 0);
        }
        let options = await workspace_1.default.getFormatOptions(doc.uri);
        let textEdits = await this.withRequestToken('format', token => {
            return languages_1.default.provideDocumentRangeFormattingEdits(doc.textDocument, range, options, token);
        });
        if (textEdits && textEdits.length > 0) {
            await doc.applyEdits(textEdits);
            return 0;
        }
        return -1;
    }
    async getTagList() {
        let { doc, position } = await this.getCurrentState();
        let word = await this.nvim.call('expand', '<cword>');
        if (!word || doc == null)
            return null;
        if (!languages_1.default.hasProvider('definition', doc.textDocument))
            return null;
        let tokenSource = new vscode_languageserver_protocol_1.CancellationTokenSource();
        let definitions = await languages_1.default.getDefinition(doc.textDocument, position, tokenSource.token);
        if (!definitions || !definitions.length)
            return null;
        return definitions.map(location => {
            let parsedURI = vscode_uri_1.URI.parse(location.uri);
            const filename = parsedURI.scheme == 'file' ? parsedURI.fsPath : parsedURI.toString();
            return {
                name: word,
                cmd: `keepjumps ${location.range.start.line + 1} | normal ${location.range.start.character + 1}|`,
                filename,
            };
        });
    }
    async runCommand(id, ...args) {
        if (id) {
            await events_1.default.fire('Command', [id]);
            let res = await commands_1.default.executeCommand(id, ...args);
            if (args.length == 0) {
                await commands_1.default.addRecent(id);
            }
            return res;
        }
        else {
            await manager_2.default.start(['commands']);
        }
    }
    async getCodeActions(doc, range, only) {
        range = range || vscode_languageserver_protocol_1.Range.create(0, 0, doc.lineCount, 0);
        let diagnostics = manager_1.default.getDiagnosticsInRange(doc.textDocument, range);
        let context = { diagnostics };
        if (only && Array.isArray(only))
            context.only = only;
        let codeActionsMap = await this.withRequestToken('code action', token => {
            return languages_1.default.getCodeActions(doc.textDocument, range, context, token);
        });
        if (!codeActionsMap)
            return [];
        let codeActions = [];
        for (let clientId of codeActionsMap.keys()) {
            let actions = codeActionsMap.get(clientId);
            for (let action of actions) {
                codeActions.push(Object.assign({ clientId }, action));
            }
        }
        codeActions.sort((a, b) => {
            if (a.isPreferred && !b.isPreferred) {
                return -1;
            }
            if (b.isPreferred && !a.isPreferred) {
                return 1;
            }
            return 0;
        });
        return codeActions;
    }
    async doCodeAction(mode, only) {
        let { doc } = await this.getCurrentState();
        if (!doc)
            return;
        let range;
        if (mode)
            range = await workspace_1.default.getSelectedRange(mode, doc);
        await synchronizeDocument(doc);
        let codeActions = await this.getCodeActions(doc, range, Array.isArray(only) ? only : null);
        if (only && typeof only == 'string') {
            codeActions = codeActions.filter(o => o.title == only || (o.command && o.command.title == only));
        }
        if (!codeActions || codeActions.length == 0) {
            workspace_1.default.showMessage(`No${only ? ' ' + only : ''} code action available`, 'warning');
            return;
        }
        let idx = await workspace_1.default.showQuickpick(codeActions.map(o => o.title));
        let action = codeActions[idx];
        if (action)
            await this.applyCodeAction(action);
    }
    /**
     * Get current codeActions
     *
     * @public
     * @returns {Promise<CodeAction[]>}
     */
    async getCurrentCodeActions(mode, only) {
        let { doc } = await this.getCurrentState();
        if (!doc)
            return [];
        let range;
        if (mode)
            range = await workspace_1.default.getSelectedRange(mode, doc);
        return await this.getCodeActions(doc, range, only);
    }
    /**
     * Invoke preferred quickfix at current position, return false when failed
     *
     * @returns {Promise<boolean>}
     */
    async doQuickfix() {
        let actions = await this.getCurrentCodeActions('n', [vscode_languageserver_protocol_1.CodeActionKind.QuickFix]);
        if (!actions || actions.length == 0) {
            workspace_1.default.showMessage('No quickfix action available', 'warning');
            return false;
        }
        await this.applyCodeAction(actions[0]);
        await this.nvim.command(`silent! call repeat#set("\\<Plug>(coc-fix-current)", -1)`);
        return true;
    }
    async applyCodeAction(action) {
        let { command, edit } = action;
        if (edit)
            await workspace_1.default.applyEdit(edit);
        if (command) {
            if (commands_1.default.has(command.command)) {
                commands_1.default.execute(command);
            }
            else {
                let clientId = action.clientId;
                let service = services_1.default.getService(clientId);
                let params = {
                    command: command.command,
                    arguments: command.arguments
                };
                if (service.client) {
                    let { client } = service;
                    client
                        .sendRequest(vscode_languageserver_protocol_1.ExecuteCommandRequest.type, params)
                        .then(undefined, error => {
                        workspace_1.default.showMessage(`Execute '${command.command} error: ${error}'`, 'error');
                    });
                }
            }
        }
    }
    async doCodeLensAction() {
        await this.codeLensManager.doAction();
    }
    async fold(kind) {
        let { doc, winid } = await this.getCurrentState();
        if (!doc)
            return false;
        await synchronizeDocument(doc);
        let win = this.nvim.createWindow(winid);
        let foldmethod = await win.getOption('foldmethod');
        if (foldmethod != 'manual') {
            workspace_1.default.showMessage('foldmethod option should be manual!', 'warning');
            return false;
        }
        let ranges = await this.withRequestToken('folding range', token => {
            return languages_1.default.provideFoldingRanges(doc.textDocument, {}, token);
        }, true);
        if (!ranges)
            return false;
        if (kind)
            ranges = ranges.filter(o => o.kind == kind);
        if (ranges.length) {
            this.nvim.pauseNotification();
            win.setOption('foldenable', true, true);
            for (let range of ranges.reverse()) {
                let { startLine, endLine } = range;
                let cmd = `${startLine + 1}, ${endLine + 1}fold`;
                this.nvim.command(cmd, true);
            }
            await this.nvim.resumeNotification();
            return true;
        }
        return false;
    }
    async pickColor() {
        await this.colors.pickColor();
    }
    async pickPresentation() {
        await this.colors.pickPresentation();
    }
    async highlight() {
        let { doc, position, winid } = await this.getCurrentState();
        if (!doc)
            return;
        await this.documentHighlighter.highlight(doc.bufnr, winid, position);
    }
    async getSymbolsRanges() {
        let { doc, position } = await this.getCurrentState();
        if (!doc)
            return null;
        let highlights = await this.documentHighlighter.getHighlights(doc, position);
        if (!highlights)
            return null;
        return highlights.map(o => o.range);
    }
    async links() {
        let { doc } = await this.getCurrentState();
        if (!doc)
            return [];
        let links = await this.withRequestToken('links', token => {
            return languages_1.default.getDocumentLinks(doc.textDocument, token);
        });
        links = links || [];
        let res = [];
        for (let link of links) {
            if (link.target) {
                res.push(link);
            }
            else {
                link = await languages_1.default.resolveDocumentLink(link);
                res.push(link);
            }
        }
        return links;
    }
    async openLink() {
        let { doc, position } = await this.getCurrentState();
        let links = await this.withRequestToken('links', token => {
            return languages_1.default.getDocumentLinks(doc.textDocument, token);
        });
        if (!links || links.length == 0)
            return false;
        for (let link of links) {
            if (position_1.positionInRange(position, link.range)) {
                let { target } = link;
                if (!target) {
                    link = await languages_1.default.resolveDocumentLink(link);
                    target = link.target;
                }
                if (target) {
                    await workspace_1.default.openResource(target);
                    return true;
                }
                return false;
            }
        }
        return false;
    }
    async getCommands() {
        let list = commands_1.default.commandList;
        let res = [];
        let { titles } = commands_1.default;
        for (let item of list) {
            res.push({
                id: item.id,
                title: titles.get(item.id) || ''
            });
        }
        return res;
    }
    /*
     * supportedSymbols must be string values of symbolKind
     */
    async selectSymbolRange(inner, visualmode, supportedSymbols) {
        let doc = await workspace_1.default.document;
        if (!doc || !doc.attached)
            return;
        let range;
        if (visualmode) {
            range = await workspace_1.default.getSelectedRange(visualmode, doc);
        }
        else {
            let pos = await workspace_1.default.getCursorPosition();
            range = vscode_languageserver_protocol_1.Range.create(pos, pos);
        }
        let symbols = await this.getDocumentSymbols(doc);
        if (!symbols || symbols.length === 0) {
            workspace_1.default.showMessage('No symbols found', 'warning');
            return;
        }
        let properties = symbols.filter(s => s.kind == 'Property');
        symbols = symbols.filter(s => supportedSymbols.includes(s.kind));
        let selectRange;
        for (let sym of symbols.reverse()) {
            if (sym.range && !object_1.equals(sym.range, range) && position_1.rangeInRange(range, sym.range)) {
                selectRange = sym.range;
                break;
            }
        }
        if (!selectRange) {
            for (let sym of properties) {
                if (sym.range && !object_1.equals(sym.range, range) && position_1.rangeInRange(range, sym.range)) {
                    selectRange = sym.range;
                    break;
                }
            }
        }
        if (inner && selectRange) {
            let { start, end } = selectRange;
            let line = doc.getline(start.line + 1);
            let endLine = doc.getline(end.line - 1);
            selectRange = vscode_languageserver_protocol_1.Range.create(start.line + 1, line.match(/^\s*/)[0].length, end.line - 1, endLine.length);
        }
        if (selectRange)
            await workspace_1.default.selectRange(selectRange);
    }
    async tryFormatOnType(ch, bufnr, insertLeave = false) {
        if (!ch || string_1.isWord(ch) || !this.preferences.formatOnType)
            return;
        if (manager_3.default.getSession(bufnr) != null)
            return;
        let doc = workspace_1.default.getDocument(bufnr);
        if (!doc || !doc.attached)
            return;
        if (!languages_1.default.hasOnTypeProvider(ch, doc.textDocument))
            return;
        const filetypes = this.preferences.formatOnTypeFiletypes;
        if (filetypes.length && !filetypes.includes(doc.filetype)) {
            // Only check formatOnTypeFiletypes when set, avoid breaking change
            return;
        }
        let position = await workspace_1.default.getCursorPosition();
        let origLine = doc.getline(position.line);
        let pos = insertLeave ? { line: position.line, character: origLine.length } : position;
        let { changedtick } = doc;
        await synchronizeDocument(doc);
        if (doc.changedtick != changedtick)
            return;
        let tokenSource = new vscode_languageserver_protocol_1.CancellationTokenSource();
        let disposable = doc.onDocumentChange(() => {
            clearTimeout(timer);
            disposable.dispose();
            tokenSource.cancel();
        });
        let timer = setTimeout(() => {
            disposable.dispose();
            tokenSource.cancel();
        }, 2000);
        let edits;
        try {
            edits = await languages_1.default.provideDocumentOnTypeEdits(ch, doc.textDocument, pos, tokenSource.token);
        }
        catch (e) {
            logger.error(`Error on format: ${e.message}`, e.stack);
        }
        if (!edits || !edits.length)
            return;
        if (tokenSource.token.isCancellationRequested)
            return;
        clearTimeout(timer);
        disposable.dispose();
        let changed = position_1.getChangedFromEdits(position, edits);
        await doc.applyEdits(edits);
        let to = changed ? vscode_languageserver_protocol_1.Position.create(position.line + changed.line, position.character + changed.character) : null;
        if (to)
            await workspace_1.default.moveTo(to);
    }
    async triggerSignatureHelp(doc, position) {
        let { signatureHelpTarget } = this.preferences;
        let part = doc.getline(position.line).slice(0, position.character);
        if (part.endsWith(')')) {
            this.signatureFactory.close();
            return;
        }
        await synchronizeDocument(doc);
        let signatureHelp = await this.withRequestToken('signature help', async (token) => {
            let timer = setTimeout(() => {
                if (!token.isCancellationRequested && this.requestTokenSource) {
                    this.requestTokenSource.cancel();
                }
            }, 2000);
            let res = await languages_1.default.getSignatureHelp(doc.textDocument, position, token);
            clearTimeout(timer);
            return res;
        });
        if (!signatureHelp || signatureHelp.signatures.length == 0) {
            this.signatureFactory.close();
            return false;
        }
        let { activeParameter, activeSignature, signatures } = signatureHelp;
        if (activeSignature) {
            // make active first
            let [active] = signatures.splice(activeSignature, 1);
            if (active)
                signatures.unshift(active);
        }
        if (signatureHelpTarget == 'echo') {
            let columns = workspace_1.default.env.columns;
            signatures = signatures.slice(0, workspace_1.default.env.cmdheight);
            let signatureList = [];
            for (let signature of signatures) {
                let parts = [];
                let { label } = signature;
                label = label.replace(/\n/g, ' ');
                if (label.length >= columns - 16) {
                    label = label.slice(0, columns - 16) + '...';
                }
                let nameIndex = label.indexOf('(');
                if (nameIndex == -1) {
                    parts = [{ text: label, type: 'Normal' }];
                }
                else {
                    parts.push({
                        text: label.slice(0, nameIndex),
                        type: 'Label'
                    });
                    let after = label.slice(nameIndex);
                    if (signatureList.length == 0 && activeParameter != null) {
                        let active = signature.parameters[activeParameter];
                        if (active) {
                            let start;
                            let end;
                            if (typeof active.label === 'string') {
                                let str = after.slice(0);
                                let ms = str.match(new RegExp('\\b' + active.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b'));
                                let idx = ms ? ms.index : str.indexOf(active.label);
                                if (idx == -1) {
                                    parts.push({ text: after, type: 'Normal' });
                                }
                                else {
                                    start = idx;
                                    end = idx + active.label.length;
                                }
                            }
                            else {
                                [start, end] = active.label;
                                start = start - nameIndex;
                                end = end - nameIndex;
                            }
                            if (start != null && end != null) {
                                parts.push({ text: after.slice(0, start), type: 'Normal' });
                                parts.push({ text: after.slice(start, end), type: 'MoreMsg' });
                                parts.push({ text: after.slice(end), type: 'Normal' });
                            }
                        }
                    }
                    else {
                        parts.push({
                            text: after,
                            type: 'Normal'
                        });
                    }
                }
                signatureList.push(parts);
            }
            this.nvim.callTimer('coc#util#echo_signatures', [signatureList], true);
        }
        else {
            let offset = 0;
            let paramDoc = null;
            let docs = signatures.reduce((p, c, idx) => {
                let activeIndexes = null;
                let nameIndex = c.label.indexOf('(');
                if (idx == 0 && activeParameter != null) {
                    let active = c.parameters[activeParameter];
                    if (active) {
                        let after = c.label.slice(nameIndex == -1 ? 0 : nameIndex);
                        paramDoc = active.documentation;
                        if (typeof active.label === 'string') {
                            let str = after.slice(0);
                            let ms = str.match(new RegExp('\\b' + active.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b'));
                            let index = ms ? ms.index : str.indexOf(active.label);
                            if (index != -1) {
                                activeIndexes = [
                                    index + nameIndex,
                                    index + active.label.length + nameIndex
                                ];
                            }
                        }
                        else {
                            activeIndexes = active.label;
                        }
                    }
                }
                if (activeIndexes == null) {
                    activeIndexes = [nameIndex + 1, nameIndex + 1];
                }
                if (offset == 0) {
                    offset = activeIndexes[0] + 1;
                }
                p.push({
                    content: c.label,
                    filetype: doc.filetype,
                    active: activeIndexes
                });
                if (paramDoc) {
                    let content = typeof paramDoc === 'string' ? paramDoc : paramDoc.value;
                    if (content.trim().length) {
                        p.push({
                            content,
                            filetype: vscode_languageserver_protocol_1.MarkupContent.is(c.documentation) ? 'markdown' : 'txt'
                        });
                    }
                }
                if (idx == 0 && c.documentation) {
                    let { documentation } = c;
                    let content = typeof documentation === 'string' ? documentation : documentation.value;
                    if (content.trim().length) {
                        p.push({
                            content,
                            filetype: vscode_languageserver_protocol_1.MarkupContent.is(c.documentation) ? 'markdown' : 'txt'
                        });
                    }
                }
                return p;
            }, []);
            if (signatureHelpTarget == 'float') {
                let session = manager_3.default.getSession(doc.bufnr);
                if (session && session.isActive) {
                    let { value } = session.placeholder;
                    if (!value.includes('\n'))
                        offset += value.length;
                    this.signaturePosition = vscode_languageserver_protocol_1.Position.create(position.line, position.character - value.length);
                }
                else {
                    this.signaturePosition = position;
                }
                await this.signatureFactory.create(docs, true, offset);
                // show float
            }
            else {
                this.documentLines = docs.reduce((p, c) => {
                    p.push('``` ' + c.filetype);
                    p.push(...c.content.split(/\r?\n/));
                    p.push('```');
                    return p;
                }, []);
                await this.nvim.command(`pedit coc://document`);
            }
        }
        return true;
    }
    async showSignatureHelp() {
        let { doc, position } = await this.getCurrentState();
        if (!doc)
            return false;
        return await this.triggerSignatureHelp(doc, position);
    }
    async findLocations(id, method, params, openCommand) {
        let { doc, position } = await this.getCurrentState();
        if (!doc)
            return null;
        params = params || {};
        Object.assign(params, {
            textDocument: { uri: doc.uri },
            position
        });
        let res = await services_1.default.sendRequest(id, method, params);
        res = res || [];
        let locations = [];
        if (Array.isArray(res)) {
            locations = res;
        }
        else if (res.hasOwnProperty('location') && res.hasOwnProperty('children')) {
            let getLocation = (item) => {
                locations.push(item.location);
                if (item.children && item.children.length) {
                    for (let loc of item.children) {
                        getLocation(loc);
                    }
                }
            };
            getLocation(res);
        }
        await this.handleLocations(locations, openCommand);
    }
    async handleLocations(definition, openCommand) {
        if (!definition)
            return;
        let locations = Array.isArray(definition) ? definition : [definition];
        let len = locations.length;
        if (len == 0)
            return;
        if (len == 1 && openCommand !== false) {
            let location = definition[0];
            if (vscode_languageserver_protocol_1.LocationLink.is(definition[0])) {
                let link = definition[0];
                location = vscode_languageserver_protocol_1.Location.create(link.targetUri, link.targetRange);
            }
            let { uri, range } = location;
            await workspace_1.default.jumpTo(uri, range.start, openCommand);
        }
        else {
            await workspace_1.default.showLocations(definition);
        }
    }
    async getSelectionRanges() {
        let { doc, position } = await this.getCurrentState();
        await synchronizeDocument(doc);
        let selectionRanges = await this.withRequestToken('selection ranges', token => {
            return languages_1.default.getSelectionRanges(doc.textDocument, [position], token);
        });
        if (selectionRanges && selectionRanges.length)
            return selectionRanges;
        return null;
    }
    async selectRange(visualmode, forward) {
        let { nvim } = this;
        let { doc } = await this.getCurrentState();
        if (!doc)
            return;
        let positions = [];
        if (!forward && (!this.selectionRange || !visualmode))
            return;
        if (visualmode) {
            let range = await workspace_1.default.getSelectedRange(visualmode, doc);
            positions.push(range.start, range.end);
        }
        else {
            let position = await workspace_1.default.getCursorPosition();
            positions.push(position);
        }
        if (!forward) {
            let curr = vscode_languageserver_protocol_1.Range.create(positions[0], positions[1]);
            let { selectionRange } = this;
            while (selectionRange && selectionRange.parent) {
                if (object_1.equals(selectionRange.parent.range, curr)) {
                    break;
                }
                selectionRange = selectionRange.parent;
            }
            if (selectionRange && selectionRange.parent) {
                await workspace_1.default.selectRange(selectionRange.range);
            }
            return;
        }
        await synchronizeDocument(doc);
        let selectionRanges = await this.withRequestToken('selection ranges', token => {
            return languages_1.default.getSelectionRanges(doc.textDocument, positions, token);
        });
        if (!selectionRanges || selectionRanges.length == 0)
            return;
        let mode = await nvim.eval('mode()');
        if (mode != 'n')
            await nvim.eval(`feedkeys("\\<Esc>", 'in')`);
        let selectionRange;
        if (selectionRanges.length == 1) {
            selectionRange = selectionRanges[0];
        }
        else if (positions.length > 1) {
            let r = vscode_languageserver_protocol_1.Range.create(positions[0], positions[1]);
            selectionRange = selectionRanges[0];
            while (selectionRange) {
                if (object_1.equals(r, selectionRange.range)) {
                    selectionRange = selectionRange.parent;
                    continue;
                }
                if (position_1.positionInRange(positions[1], selectionRange.range) == 0) {
                    break;
                }
                selectionRange = selectionRange.parent;
            }
        }
        if (!selectionRange)
            return;
        this.selectionRange = selectionRanges[0];
        await workspace_1.default.selectRange(selectionRange.range);
    }
    async codeActionRange(start, end, only) {
        let { doc } = await this.getCurrentState();
        if (!doc)
            return;
        await synchronizeDocument(doc);
        let line = doc.getline(end - 1);
        let range = vscode_languageserver_protocol_1.Range.create(start - 1, 0, end - 1, line.length);
        let codeActions = await this.getCodeActions(doc, range, only ? [only] : null);
        if (!codeActions || codeActions.length == 0) {
            workspace_1.default.showMessage(`No${only ? ' ' + only : ''} code action available`, 'warning');
            return;
        }
        let idx = await workspace_1.default.showQuickpick(codeActions.map(o => o.title));
        let action = codeActions[idx];
        if (action)
            await this.applyCodeAction(action);
    }
    /**
     * Refactor of current symbol
     */
    async doRefactor() {
        let [bufnr, cursor, filetype] = await this.nvim.eval('[bufnr("%"),coc#util#cursor(),&filetype]');
        let doc = workspace_1.default.getDocument(bufnr);
        if (!doc || !doc.attached)
            return;
        await synchronizeDocument(doc);
        let position = { line: cursor[0], character: cursor[1] };
        let edit = await this.withRequestToken('refactor', async (token) => {
            let res = await languages_1.default.prepareRename(doc.textDocument, position, token);
            if (token.isCancellationRequested)
                return null;
            if (res === false) {
                workspace_1.default.showMessage('Invalid position', 'warning');
                return null;
            }
            let edit = await languages_1.default.provideRenameEdits(doc.textDocument, position, 'NewName', token);
            if (token.isCancellationRequested)
                return null;
            if (!edit) {
                workspace_1.default.showMessage('Empty workspaceEdit from language server', 'warning');
                return null;
            }
            return edit;
        });
        if (edit) {
            let refactor = await refactor_1.default.createFromWorkspaceEdit(edit, filetype);
            if (!refactor || !refactor.buffer)
                return;
            this.refactorMap.set(refactor.buffer.id, refactor);
        }
    }
    async saveRefactor(bufnr) {
        let refactor = this.refactorMap.get(bufnr);
        if (refactor) {
            await refactor.saveRefactor();
        }
    }
    async search(args) {
        let refactor = new refactor_1.default();
        await refactor.createRefactorBuffer();
        if (!refactor.buffer)
            return;
        this.refactorMap.set(refactor.buffer.id, refactor);
        let search = new search_1.default(this.nvim);
        search.run(args, workspace_1.default.cwd, refactor).logError();
    }
    async previewHover(hovers) {
        let lines = [];
        let target = this.preferences.hoverTarget;
        let i = 0;
        let docs = [];
        for (let hover of hovers) {
            let { contents } = hover;
            if (i > 0)
                lines.push('---');
            if (Array.isArray(contents)) {
                for (let item of contents) {
                    if (typeof item === 'string') {
                        if (item.trim().length) {
                            lines.push(...item.split('\n'));
                            docs.push({ content: item, filetype: 'markdown' });
                        }
                    }
                    else {
                        let content = item.value.trim();
                        if (target == 'preview') {
                            content = '``` ' + item.language + '\n' + content + '\n```';
                        }
                        lines.push(...content.trim().split('\n'));
                        docs.push({ filetype: item.language, content: item.value });
                    }
                }
            }
            else if (typeof contents == 'string') {
                lines.push(...contents.split('\n'));
                docs.push({ content: contents, filetype: 'markdown' });
            }
            else if (vscode_languageserver_protocol_1.MarkedString.is(contents)) {
                let content = contents.value.trim();
                if (target == 'preview') {
                    content = '``` ' + contents.language + '\n' + content + '\n```';
                }
                lines.push(...content.split('\n'));
                docs.push({ filetype: contents.language, content: contents.value });
            }
            else if (vscode_languageserver_protocol_1.MarkupContent.is(contents)) {
                lines.push(...contents.value.split('\n'));
                docs.push({ filetype: contents.kind == 'markdown' ? 'markdown' : 'txt', content: contents.value });
            }
            i++;
        }
        if (target == 'echo') {
            const msg = lines.join('\n').trim();
            if (msg.length) {
                await this.nvim.call('coc#util#echo_hover', msg);
            }
        }
        else if (target == 'float') {
            manager_1.default.hideFloat();
            await this.hoverFactory.create(docs);
        }
        else {
            this.documentLines = lines;
            let arr = await this.nvim.call('getcurpos');
            this.hoverPosition = [workspace_1.default.bufnr, arr[1], arr[2]];
            await this.nvim.command(`pedit coc://document`);
        }
    }
    getPreferences() {
        let config = workspace_1.default.getConfiguration('coc.preferences');
        let hoverTarget = config.get('hoverTarget', 'float');
        if (hoverTarget == 'float' && !workspace_1.default.env.floating && !workspace_1.default.env.textprop) {
            hoverTarget = 'preview';
        }
        let signatureConfig = workspace_1.default.getConfiguration('signature');
        let signatureHelpTarget = signatureConfig.get('target', 'float');
        if (signatureHelpTarget == 'float' && !workspace_1.default.floatSupported) {
            signatureHelpTarget = 'echo';
        }
        this.labels = workspace_1.default.getConfiguration('suggest').get('completionItemKindLabels', {});
        this.preferences = {
            hoverTarget,
            signatureHelpTarget,
            signatureMaxHeight: signatureConfig.get('maxWindowHeight', 8),
            triggerSignatureHelp: signatureConfig.get('enable', true),
            triggerSignatureWait: Math.max(signatureConfig.get('triggerSignatureWait', 50), 50),
            signaturePreferAbove: signatureConfig.get('preferShownAbove', true),
            signatureFloatMaxWidth: signatureConfig.get('floatMaxWidth', 60),
            signatureHideOnChange: signatureConfig.get('hideOnTextChange', false),
            formatOnType: config.get('formatOnType', false),
            formatOnTypeFiletypes: config.get('formatOnTypeFiletypes', []),
            formatOnInsertLeave: config.get('formatOnInsertLeave', false),
            bracketEnterImprove: config.get('bracketEnterImprove', true),
            previewMaxHeight: config.get('previewMaxHeight', 12),
            previewAutoClose: config.get('previewAutoClose', false),
            currentFunctionSymbolAutoUpdate: config.get('currentFunctionSymbolAutoUpdate', false),
        };
    }
    async getCurrentState() {
        let { nvim } = this;
        let [bufnr, [line, character], winid] = await nvim.eval("[bufnr('%'),coc#util#cursor(),win_getid()]");
        let doc = workspace_1.default.getDocument(bufnr);
        return {
            doc: doc && doc.attached ? doc : null,
            position: vscode_languageserver_protocol_1.Position.create(line, character),
            winid
        };
    }
    dispose() {
        this.colors.dispose();
        util_1.disposeAll(this.disposables);
    }
}
exports.default = Handler;
function getPreviousContainer(containerName, symbols) {
    if (!symbols.length)
        return null;
    let i = symbols.length - 1;
    let last = symbols[i];
    if (last.text == containerName) {
        return last;
    }
    while (i >= 0) {
        let sym = symbols[i];
        if (sym.text == containerName) {
            return sym;
        }
        i--;
    }
    return null;
}
function sortDocumentSymbols(a, b) {
    let ra = a.selectionRange;
    let rb = b.selectionRange;
    if (ra.start.line < rb.start.line) {
        return -1;
    }
    if (ra.start.line > rb.start.line) {
        return 1;
    }
    return ra.start.character - rb.start.character;
}
function addDoucmentSymbol(res, sym, level) {
    let { name, selectionRange, kind, children, range } = sym;
    let { start } = selectionRange;
    res.push({
        col: start.character + 1,
        lnum: start.line + 1,
        text: name,
        level,
        kind: convert_1.getSymbolKind(kind),
        range,
        selectionRange
    });
    if (children && children.length) {
        children.sort(sortDocumentSymbols);
        for (let sym of children) {
            addDoucmentSymbol(res, sym, level + 1);
        }
    }
}
function sortSymbolInformations(a, b) {
    let sa = a.location.range.start;
    let sb = b.location.range.start;
    let d = sa.line - sb.line;
    return d == 0 ? sa.character - sb.character : d;
}
function isDocumentSymbol(a) {
    return a && !a.hasOwnProperty('location');
}
function isDocumentSymbols(a) {
    return isDocumentSymbol(a[0]);
}
async function synchronizeDocument(doc) {
    let { changedtick } = doc;
    await doc.patchChange();
    if (changedtick != doc.changedtick) {
        await util_1.wait(50);
    }
}
//# sourceMappingURL=index.js.map