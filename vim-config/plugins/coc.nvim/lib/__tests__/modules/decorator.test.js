"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const decorator = tslib_1.__importStar(require("../../util/decorator"));
class CallTest {
    constructor() {
        this.count = 0;
    }
    async memorized() { return ++this.count; }
}
tslib_1.__decorate([
    decorator.memorize
], CallTest.prototype, "memorized", null);
describe('memorize', () => {
    test('overlapping', async () => {
        const c = new CallTest();
        const first = c.memorized();
        const second = c.memorized();
        expect(await first).toBe(1);
        expect(await second).toBe(2);
    });
    test('nonoverlapping', async () => {
        const c = new CallTest();
        const first = c.memorized();
        expect(await first).toBe(1);
        const second = c.memorized();
        expect(await second).toBe(1);
    });
});
//# sourceMappingURL=decorator.test.js.map