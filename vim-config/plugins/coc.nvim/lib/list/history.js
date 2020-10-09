"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const fuzzy_1 = require("../util/fuzzy");
const workspace_1 = tslib_1.__importDefault(require("../workspace"));
const logger = require('../util/logger')('list-history');
class InputHistory {
    constructor(prompt, name) {
        this.prompt = prompt;
        this.name = name;
        this.index = -1;
        this.loaded = [];
        this.current = [];
        this.db = workspace_1.default.createDatabase(`list-${name}-history`);
        this.key = Buffer.from(workspace_1.default.cwd).toString('base64');
    }
    filter() {
        let { input } = this.prompt;
        if (input == this.curr)
            return;
        this.historyInput = '';
        let codes = fuzzy_1.getCharCodes(input);
        this.current = this.loaded.filter(s => fuzzy_1.fuzzyMatch(codes, s));
        this.index = -1;
    }
    get curr() {
        return this.index == -1 ? null : this.current[this.index];
    }
    load(input) {
        let { db } = this;
        input = input || '';
        let arr = db.fetch(this.key);
        if (!arr || !Array.isArray(arr)) {
            this.loaded = [];
        }
        else {
            this.loaded = arr;
        }
        this.index = -1;
        this.current = this.loaded.filter(s => s.startsWith(input));
    }
    add() {
        let { loaded, db, prompt } = this;
        let { input } = prompt;
        if (!input || input.length < 2 || input == this.historyInput)
            return;
        let idx = loaded.indexOf(input);
        if (idx != -1)
            loaded.splice(idx, 1);
        loaded.push(input);
        if (loaded.length > 200) {
            loaded = loaded.slice(-200);
        }
        db.push(this.key, loaded);
    }
    previous() {
        let { current, index } = this;
        if (!current || !current.length)
            return;
        if (index <= 0) {
            this.index = current.length - 1;
        }
        else {
            this.index = index - 1;
        }
        this.historyInput = this.prompt.input = current[this.index] || '';
    }
    next() {
        let { current, index } = this;
        if (!current || !current.length)
            return;
        if (index == current.length - 1) {
            this.index = 0;
        }
        else {
            this.index = index + 1;
        }
        this.historyInput = this.prompt.input = current[this.index] || '';
    }
}
exports.default = InputHistory;
//# sourceMappingURL=history.js.map