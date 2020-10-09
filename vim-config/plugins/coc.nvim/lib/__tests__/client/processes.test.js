"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const child_process_1 = require("child_process");
const processes_1 = require("../../util/processes");
const helper_1 = tslib_1.__importDefault(require("../helper"));
describe('terminate', () => {
    it('should terminate process', async () => {
        let cwd = process.cwd();
        let child = child_process_1.spawn('sleep', ['10'], { cwd, detached: true });
        let res = processes_1.terminate(child, cwd);
        await helper_1.default.wait(60);
        expect(res).toBe(true);
        expect(child.connected).toBe(false);
    });
});
//# sourceMappingURL=processes.test.js.map