"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const events_1 = tslib_1.__importDefault(require("../../events"));
describe('register handler', () => {
    it('should register single handler', async () => {
        let fn = jest.fn();
        let obj = {};
        let disposable = events_1.default.on('BufEnter', fn, obj);
        await events_1.default.fire('BufEnter', ['a', 'b']);
        expect(fn).toBeCalledWith('a', 'b');
        disposable.dispose();
    });
    it('should register multiple events', async () => {
        let fn = jest.fn();
        let disposable = events_1.default.on(['TaskExit', 'TaskStderr'], fn);
        await events_1.default.fire('TaskExit', []);
        await events_1.default.fire('TaskStderr', []);
        expect(fn).toBeCalledTimes(2);
        disposable.dispose();
    });
    it('should resolve before timeout', async () => {
        let fn = () => new Promise(resolve => {
            setTimeout(() => {
                resolve();
            }, 5000);
        });
        let disposable = events_1.default.on('FocusGained', fn, {});
        let ts = Date.now();
        await events_1.default.fire('FocusGained', []);
        expect(Date.now() - ts).toBeLessThan(5100);
        disposable.dispose();
    }, 10000);
});
//# sourceMappingURL=events.test.js.map