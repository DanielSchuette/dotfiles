"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Completion = void 0;
const tslib_1 = require("tslib");
const vscode_languageserver_protocol_1 = require("vscode-languageserver-protocol");
const events_1 = tslib_1.__importDefault(require("../events"));
const sources_1 = tslib_1.__importDefault(require("../sources"));
const util_1 = require("../util");
const workspace_1 = tslib_1.__importDefault(require("../workspace"));
const complete_1 = tslib_1.__importDefault(require("./complete"));
const floating_1 = tslib_1.__importDefault(require("./floating"));
const throttle_1 = tslib_1.__importDefault(require("../util/throttle"));
const object_1 = require("../util/object");
const string_1 = require("../util/string");
const logger = require('../util/logger')('completion');
const completeItemKeys = ['abbr', 'menu', 'info', 'kind', 'icase', 'dup', 'empty', 'user_data'];
class Completion {
    constructor() {
        // current input string
        this.activated = false;
        this.disposables = [];
        this.complete = null;
        this.recentScores = {};
        this.changedTick = 0;
        this.insertCharTs = 0;
        this.insertLeaveTs = 0;
    }
    init() {
        this.config = this.getCompleteConfig();
        this.floating = new floating_1.default();
        events_1.default.on('InsertCharPre', this.onInsertCharPre, this, this.disposables);
        events_1.default.on('InsertLeave', this.onInsertLeave, this, this.disposables);
        events_1.default.on('InsertEnter', this.onInsertEnter, this, this.disposables);
        events_1.default.on('TextChangedP', this.onTextChangedP, this, this.disposables);
        events_1.default.on('TextChangedI', this.onTextChangedI, this, this.disposables);
        let fn = throttle_1.default(this.onPumChange.bind(this), workspace_1.default.isVim ? 200 : 100);
        events_1.default.on('CompleteDone', async (item) => {
            this.currItem = null;
            this.cancelResolve();
            this.floating.close();
            await this.onCompleteDone(item);
        }, this, this.disposables);
        events_1.default.on('MenuPopupChanged', ev => {
            if (!this.activated || this.isCommandLine)
                return;
            let { completed_item } = ev;
            let item = completed_item.hasOwnProperty('word') ? completed_item : null;
            if (object_1.equals(item, this.currItem))
                return;
            this.cancelResolve();
            this.currItem = item;
            fn(ev);
        }, this, this.disposables);
        workspace_1.default.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('suggest')) {
                this.config = this.getCompleteConfig();
            }
        }, null, this.disposables);
    }
    get nvim() {
        return workspace_1.default.nvim;
    }
    get option() {
        if (!this.complete)
            return null;
        return this.complete.option;
    }
    get isCommandLine() {
        var _a;
        return (_a = this.document) === null || _a === void 0 ? void 0 : _a.uri.endsWith('%5BCommand%20Line%5D');
    }
    addRecent(word, bufnr) {
        if (!word)
            return;
        this.recentScores[`${bufnr}|${word}`] = Date.now();
    }
    get isActivated() {
        return this.activated;
    }
    get document() {
        if (!this.option)
            return null;
        return workspace_1.default.getDocument(this.option.bufnr);
    }
    getCompleteConfig() {
        let suggest = workspace_1.default.getConfiguration('suggest');
        function getConfig(key, defaultValue) {
            return suggest.get(key, suggest.get(key, defaultValue));
        }
        let keepCompleteopt = getConfig('keepCompleteopt', false);
        let autoTrigger = getConfig('autoTrigger', 'always');
        if (keepCompleteopt && autoTrigger != 'none') {
            let { completeOpt } = workspace_1.default;
            if (!completeOpt.includes('noinsert') && !completeOpt.includes('noselect')) {
                autoTrigger = 'none';
            }
        }
        let acceptSuggestionOnCommitCharacter = workspace_1.default.env.pumevent && getConfig('acceptSuggestionOnCommitCharacter', false);
        return {
            autoTrigger,
            keepCompleteopt,
            defaultSortMethod: getConfig('defaultSortMethod', 'length'),
            removeDuplicateItems: getConfig('removeDuplicateItems', false),
            disableMenuShortcut: getConfig('disableMenuShortcut', false),
            acceptSuggestionOnCommitCharacter,
            disableKind: getConfig('disableKind', false),
            disableMenu: getConfig('disableMenu', false),
            previewIsKeyword: getConfig('previewIsKeyword', '@,48-57,_192-255'),
            enablePreview: getConfig('enablePreview', false),
            enablePreselect: getConfig('enablePreselect', false),
            maxPreviewWidth: getConfig('maxPreviewWidth', 80),
            triggerCompletionWait: getConfig('triggerCompletionWait', 50),
            labelMaxLength: getConfig('labelMaxLength', 200),
            triggerAfterInsertEnter: getConfig('triggerAfterInsertEnter', false),
            noselect: getConfig('noselect', true),
            numberSelect: getConfig('numberSelect', false),
            maxItemCount: getConfig('maxCompleteItemCount', 50),
            timeout: getConfig('timeout', 500),
            minTriggerInputLength: getConfig('minTriggerInputLength', 1),
            snippetIndicator: getConfig('snippetIndicator', '~'),
            fixInsertedWord: getConfig('fixInsertedWord', true),
            localityBonus: getConfig('localityBonus', true),
            highPrioritySourceLimit: getConfig('highPrioritySourceLimit', null),
            lowPrioritySourceLimit: getConfig('lowPrioritySourceLimit', null),
            asciiCharactersOnly: getConfig('asciiCharactersOnly', false)
        };
    }
    async startCompletion(option) {
        this.pretext = string_1.byteSlice(option.line, 0, option.colnr - 1);
        try {
            await this._doComplete(option);
        }
        catch (e) {
            this.stop();
            workspace_1.default.showMessage(`Complete error: ${e.message}`, 'error');
            logger.error(e.stack);
        }
    }
    async resumeCompletion(force = false) {
        let { document, complete } = this;
        if (!document
            || complete.isCanceled
            || !complete.results
            || complete.results.length == 0)
            return;
        let search = this.getResumeInput();
        if (search == this.input && !force)
            return;
        if (!search || search.endsWith(' ') || !search.startsWith(complete.input)) {
            this.stop();
            return;
        }
        this.input = search;
        let items = [];
        if (complete.isIncomplete) {
            await document.patchChange();
            let { changedtick } = document;
            items = await complete.completeInComplete(search);
            if (complete.isCanceled || document.changedtick != changedtick)
                return;
        }
        else {
            items = complete.filterResults(search);
        }
        if (!complete.isCompleting && items.length === 0) {
            this.stop();
            return;
        }
        await this.showCompletion(complete.option.col, items);
    }
    hasSelected() {
        if (workspace_1.default.env.pumevent)
            return this.currItem != null;
        if (!this.config.noselect)
            return true;
        return false;
    }
    async showCompletion(col, items) {
        let { nvim, document, option } = this;
        let { numberSelect, disableKind, labelMaxLength, disableMenuShortcut, disableMenu } = this.config;
        let preselect = this.config.enablePreselect ? items.findIndex(o => o.preselect) : -1;
        if (numberSelect && option.input.length && !/^\d/.test(option.input)) {
            items = items.map((item, i) => {
                let idx = i + 1;
                if (i < 9) {
                    return Object.assign({}, item, {
                        abbr: item.abbr ? `${idx} ${item.abbr}` : `${idx} ${item.word}`
                    });
                }
                return item;
            });
            nvim.call('coc#_map', [], true);
        }
        this.changedTick = document.changedtick;
        let validKeys = completeItemKeys.slice();
        if (disableKind)
            validKeys = validKeys.filter(s => s != 'kind');
        if (disableMenu)
            validKeys = validKeys.filter(s => s != 'menu');
        let vimItems = items.map(item => {
            let obj = { word: item.word, equal: 1 };
            for (let key of validKeys) {
                if (item.hasOwnProperty(key)) {
                    if (disableMenuShortcut && key == 'menu') {
                        obj[key] = item[key].replace(/\[.+\]$/, '');
                    }
                    else if (key == 'abbr' && item[key].length > labelMaxLength) {
                        obj[key] = item[key].slice(0, labelMaxLength);
                    }
                    else {
                        obj[key] = item[key];
                    }
                }
            }
            return obj;
        });
        nvim.call('coc#_do_complete', [col, vimItems, preselect], true);
    }
    async _doComplete(option) {
        let { source } = option;
        let { nvim, config } = this;
        let document = workspace_1.default.getDocument(option.bufnr);
        if (!document || !document.attached)
            return;
        // use fixed filetype
        option.filetype = document.filetype;
        // current input
        this.input = option.input;
        let arr = [];
        if (source == null) {
            arr = sources_1.default.getCompleteSources(option);
        }
        else {
            let s = sources_1.default.getSource(source);
            if (s)
                arr.push(s);
        }
        if (!arr.length)
            return;
        await util_1.wait(this.config.triggerCompletionWait);
        await document.patchChange();
        // document get changed, not complete
        if (document.changedtick != option.changedtick)
            return;
        let complete = new complete_1.default(option, document, this.recentScores, config, arr, nvim);
        this.start(complete);
        let items = await this.complete.doComplete();
        if (complete.isCanceled)
            return;
        if (items.length == 0 && !complete.isCompleting) {
            this.stop();
            return;
        }
        complete.onDidComplete(async () => {
            let search = this.getResumeInput();
            if (complete.isCanceled || search == null)
                return;
            if (this.currItem != null && this.completeOpt.includes('noselect'))
                return;
            let { input } = this.option;
            if (search == input) {
                let items = complete.filterResults(search, Math.floor(Date.now() / 1000));
                await this.showCompletion(option.col, items);
            }
            else {
                await this.resumeCompletion();
            }
        });
        if (items.length) {
            let search = this.getResumeInput();
            if (search == option.input) {
                await this.showCompletion(option.col, items);
            }
            else {
                await this.resumeCompletion(true);
            }
        }
    }
    async onTextChangedP(bufnr, info) {
        let { option, document } = this;
        let pretext = this.pretext = info.pre;
        // avoid trigger filter on pumvisible
        if (!option || option.bufnr != bufnr || info.changedtick == this.changedTick)
            return;
        let hasInsert = this.latestInsert != null;
        this.lastInsert = null;
        if (info.pre.match(/^\s*/)[0] !== option.line.match(/^\s*/)[0]) {
            // Can't handle indent change
            this.stop();
            return;
        }
        // not handle when not triggered by character insert
        if (!hasInsert || !pretext)
            return;
        if (sources_1.default.shouldTrigger(pretext, document.filetype)) {
            await this.triggerCompletion(document, pretext, false);
        }
        else {
            await this.resumeCompletion();
        }
    }
    async onTextChangedI(bufnr, info) {
        let { nvim, latestInsertChar, option } = this;
        let noChange = this.pretext == info.pre;
        let pretext = this.pretext = info.pre;
        this.lastInsert = null;
        let document = workspace_1.default.getDocument(bufnr);
        if (!document || !document.attached)
            return;
        // try trigger on character type
        if (!this.activated) {
            if (!latestInsertChar)
                return;
            await this.triggerCompletion(document, this.pretext);
            return;
        }
        // Ignore change with other buffer
        if (!option)
            return;
        if (bufnr != option.bufnr
            || option.linenr != info.lnum
            || option.col >= info.col - 1) {
            this.stop();
            return;
        }
        // Completion is canceled by <C-e>
        if (noChange && !latestInsertChar) {
            this.stop();
            return;
        }
        // Check commit character
        if (pretext
            && this.currItem
            && this.config.acceptSuggestionOnCommitCharacter
            && latestInsertChar) {
            let resolvedItem = this.getCompleteItem(this.currItem);
            let last = pretext[pretext.length - 1];
            if (sources_1.default.shouldCommit(resolvedItem, last)) {
                let { linenr, col, line, colnr } = this.option;
                this.stop();
                let { word } = resolvedItem;
                let newLine = `${line.slice(0, col)}${word}${latestInsertChar}${line.slice(colnr - 1)}`;
                await nvim.call('coc#util#setline', [linenr, newLine]);
                let curcol = col + word.length + 2;
                await nvim.call('cursor', [linenr, curcol]);
                await document.patchChange();
                return;
            }
        }
        // prefer trigger completion
        if (sources_1.default.shouldTrigger(pretext, document.filetype)) {
            await this.triggerCompletion(document, pretext, false);
        }
        else {
            await this.resumeCompletion();
        }
    }
    async triggerCompletion(document, pre, checkTrigger = true) {
        if (this.config.autoTrigger == 'none')
            return;
        // check trigger
        if (checkTrigger) {
            let shouldTrigger = this.shouldTrigger(document, pre);
            if (!shouldTrigger)
                return;
        }
        await document.patchChange();
        let option = await this.nvim.call('coc#util#get_complete_option');
        if (!option)
            return;
        if (pre.length) {
            option.triggerCharacter = pre.slice(-1);
        }
        logger.debug('trigger completion with', option);
        await this.startCompletion(option);
    }
    async onCompleteDone(item) {
        let { document, isActivated } = this;
        if (!isActivated || !document || !item.hasOwnProperty('word'))
            return;
        let opt = Object.assign({}, this.option);
        let resolvedItem = this.getCompleteItem(item);
        this.stop();
        if (!resolvedItem)
            return;
        let timestamp = this.insertCharTs;
        let insertLeaveTs = this.insertLeaveTs;
        try {
            await sources_1.default.doCompleteResolve(resolvedItem, (new vscode_languageserver_protocol_1.CancellationTokenSource()).token);
            this.addRecent(resolvedItem.word, document.bufnr);
            // Wait possible TextChangedI
            await util_1.wait(50);
            if (this.insertCharTs != timestamp
                || this.insertLeaveTs != insertLeaveTs)
                return;
            let [visible, lnum, pre] = await this.nvim.eval(`[pumvisible(),line('.'),strpart(getline('.'), 0, col('.') - 1)]`);
            if (visible || lnum != opt.linenr || this.activated || !pre.endsWith(resolvedItem.word))
                return;
            await document.patchChange();
            await sources_1.default.doCompleteDone(resolvedItem, opt);
        }
        catch (e) {
            logger.error(`error on complete done`, e.stack);
        }
    }
    async onInsertLeave() {
        this.insertLeaveTs = Date.now();
        this.stop();
    }
    async onInsertEnter(bufnr) {
        if (!this.config.triggerAfterInsertEnter || this.config.autoTrigger !== 'always')
            return;
        let doc = workspace_1.default.getDocument(bufnr);
        if (!doc || !doc.attached)
            return;
        let pre = await this.nvim.eval(`strpart(getline('.'), 0, col('.') - 1)`);
        if (!pre)
            return;
        await this.triggerCompletion(doc, pre);
    }
    async onInsertCharPre(character) {
        this.lastInsert = {
            character,
            timestamp: Date.now(),
        };
        this.insertCharTs = this.lastInsert.timestamp;
    }
    get latestInsert() {
        let { lastInsert } = this;
        if (!lastInsert || Date.now() - lastInsert.timestamp > 500) {
            return null;
        }
        return lastInsert;
    }
    get latestInsertChar() {
        let { latestInsert } = this;
        if (!latestInsert)
            return '';
        return latestInsert.character;
    }
    shouldTrigger(document, pre) {
        if (pre.length == 0 || /\s/.test(pre[pre.length - 1]))
            return false;
        let autoTrigger = this.config.autoTrigger;
        if (autoTrigger == 'none')
            return false;
        if (sources_1.default.shouldTrigger(pre, document.filetype))
            return true;
        if (autoTrigger !== 'always' || this.isActivated)
            return false;
        let last = pre.slice(-1);
        if (last && (document.isWord(pre.slice(-1)) || last.codePointAt(0) > 255)) {
            let minLength = this.config.minTriggerInputLength;
            if (minLength == 1)
                return true;
            let input = this.getInput(document, pre);
            return input.length >= minLength;
        }
        return false;
    }
    async onPumChange(ev) {
        if (!this.activated)
            return;
        let { completed_item, col, row, height, width, scrollbar } = ev;
        let bounding = { col, row, height, width, scrollbar };
        let resolvedItem = this.getCompleteItem(completed_item);
        if (!resolvedItem) {
            this.floating.close();
            return;
        }
        let source = this.resolveTokenSource = new vscode_languageserver_protocol_1.CancellationTokenSource();
        let { token } = source;
        await sources_1.default.doCompleteResolve(resolvedItem, token);
        this.resolveTokenSource = null;
        if (token.isCancellationRequested)
            return;
        let docs = resolvedItem.documentation;
        if (!docs && resolvedItem.info) {
            let { info } = resolvedItem;
            let isText = /^[\w-\s.,\t]+$/.test(info);
            docs = [{ filetype: isText ? 'txt' : this.document.filetype, content: info }];
        }
        if (!this.isActivated)
            return;
        if (!docs || docs.length == 0) {
            this.floating.close();
        }
        else {
            await this.floating.show(docs, bounding, token);
            if (!this.isActivated) {
                this.floating.close();
            }
        }
    }
    start(complete) {
        let { activated } = this;
        this.activated = true;
        if (activated) {
            this.complete.dispose();
        }
        this.complete = complete;
        if (!this.config.keepCompleteopt) {
            this.nvim.command(`noa set completeopt=${this.completeOpt}`, true);
        }
    }
    cancelResolve() {
        if (this.resolveTokenSource) {
            this.resolveTokenSource.cancel();
            this.resolveTokenSource = null;
        }
    }
    stop() {
        let { nvim } = this;
        if (!this.activated)
            return;
        this.currItem = null;
        this.activated = false;
        if (this.complete) {
            this.complete.dispose();
            this.complete = null;
        }
        nvim.pauseNotification();
        if (this.config.numberSelect) {
            nvim.call('coc#_unmap', [], true);
        }
        if (!this.config.keepCompleteopt) {
            this.nvim.command(`noa set completeopt=${workspace_1.default.completeOpt}`, true);
        }
        nvim.command(`let g:coc#_context['candidates'] = []`, true);
        nvim.call('coc#_hide', [], true);
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        nvim.resumeNotification(false, true);
    }
    getInput(document, pre) {
        let input = '';
        for (let i = pre.length - 1; i >= 0; i--) {
            let ch = i == 0 ? null : pre[i - 1];
            if (!ch || !document.isWord(ch)) {
                input = pre.slice(i, pre.length);
                break;
            }
        }
        return input;
    }
    getResumeInput() {
        let { option, pretext } = this;
        if (!option)
            return null;
        let buf = Buffer.from(pretext, 'utf8');
        if (buf.length < option.col)
            return null;
        let input = buf.slice(option.col).toString('utf8');
        if (option.blacklist && option.blacklist.includes(input))
            return null;
        return input;
    }
    get completeOpt() {
        let { noselect, enablePreview } = this.config;
        let preview = enablePreview && !workspace_1.default.env.pumevent ? ',preview' : '';
        if (noselect)
            return `noselect,menuone${preview}`;
        return `noinsert,menuone${preview}`;
    }
    getCompleteItem(item) {
        if (!this.complete || item == null)
            return null;
        return this.complete.resolveCompletionItem(item);
    }
    dispose() {
        util_1.disposeAll(this.disposables);
    }
}
exports.Completion = Completion;
exports.default = new Completion();
//# sourceMappingURL=index.js.map