"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const commands_1 = tslib_1.__importDefault(require("../../commands"));
const events_1 = tslib_1.__importDefault(require("../../events"));
const workspace_1 = tslib_1.__importDefault(require("../../workspace"));
const basic_1 = tslib_1.__importDefault(require("../basic"));
class CommandsList extends basic_1.default {
    constructor(nvim) {
        super(nvim);
        this.defaultAction = 'run';
        this.description = 'registered commands of coc.nvim';
        this.name = 'commands';
        this.mru = workspace_1.default.createMru('commands');
        this.addAction('run', async (item) => {
            let { cmd } = item.data;
            await events_1.default.fire('Command', [cmd]);
            commands_1.default.executeCommand(cmd).logError();
            await commands_1.default.addRecent(cmd);
        });
        this.addAction('append', async (item) => {
            let { cmd } = item.data;
            await nvim.feedKeys(`:CocCommand ${cmd} `, 'n', false);
        });
    }
    async loadItems(_context) {
        let items = [];
        let list = commands_1.default.commandList;
        let { titles } = commands_1.default;
        let mruList = await this.mru.load();
        for (const o of list) {
            const { id } = o;
            items.push({
                label: `${id}\t${titles.get(id) || ''}`,
                filterText: id,
                data: { cmd: id, score: score(mruList, id) }
            });
        }
        items.sort((a, b) => b.data.score - a.data.score);
        return items;
    }
    doHighlight() {
        let { nvim } = this;
        nvim.pauseNotification();
        nvim.command('syntax match CocCommandsTitle /\\t.*$/ contained containedin=CocCommandsLine', true);
        nvim.command('highlight default link CocCommandsTitle Comment', true);
        nvim.resumeNotification().catch(_e => {
            // noop
        });
    }
}
exports.default = CommandsList;
function score(list, key) {
    let idx = list.indexOf(key);
    return idx == -1 ? -1 : list.length - idx;
}
//# sourceMappingURL=commands.js.map