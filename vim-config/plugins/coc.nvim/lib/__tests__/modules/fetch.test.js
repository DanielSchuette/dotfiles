"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const fs_1 = tslib_1.__importDefault(require("fs"));
const os_1 = tslib_1.__importDefault(require("os"));
const path_1 = tslib_1.__importDefault(require("path"));
const rimraf_1 = tslib_1.__importDefault(require("rimraf"));
const url_1 = require("url");
const util_1 = require("util");
const download_1 = tslib_1.__importDefault(require("../../model/download"));
const fetch_1 = tslib_1.__importStar(require("../../model/fetch"));
const helper_1 = tslib_1.__importDefault(require("../helper"));
beforeAll(async () => {
    await helper_1.default.setup();
});
afterAll(async () => {
    await helper_1.default.shutdown();
});
afterEach(async () => {
    helper_1.default.updateConfiguration('http.proxy', '');
    await helper_1.default.reset();
});
describe('fetch', () => {
    it('should fetch json', async () => {
        let res = await fetch_1.default('https://nodejs.org/dist/index.json');
        expect(Array.isArray(res)).toBe(true);
    }, 10000);
    it('should throw on request error', async () => {
        let err;
        try {
            await fetch_1.default('http://not_exists_org');
        }
        catch (e) {
            err = e;
        }
        expect(err).toBeDefined();
    });
    it('should report valid proxy', async () => {
        let agent = fetch_1.getAgent(url_1.parse('http://google.com'), { proxyUrl: 'domain.com:1234' });
        expect(agent).toBe(null);
        agent = fetch_1.getAgent(url_1.parse('http://google.com'), { proxyUrl: 'https://domain.com:1234' });
        let proxy = agent.proxy;
        expect(proxy.host).toBe('domain.com');
        expect(proxy.port).toBe(1234);
        agent = fetch_1.getAgent(url_1.parse('http://google.com'), { proxyUrl: 'http://user:pass@domain.com:1234' });
        proxy = agent.proxy;
        expect(proxy.host).toBe('domain.com');
        expect(proxy.port).toBe(1234);
        expect(proxy.auth).toBe('user:pass');
    });
});
describe('download', () => {
    it('should download binary file', async () => {
        let url = 'https://registry.npmjs.org/coc-pairs/-/coc-pairs-1.2.13.tgz';
        let tmpFolder = await util_1.promisify(fs_1.default.mkdtemp)(path_1.default.join(os_1.default.tmpdir(), 'coc-test'));
        let res = await download_1.default(url, { dest: tmpFolder });
        expect(fs_1.default.existsSync(res)).toBe(true);
        await util_1.promisify(rimraf_1.default)(tmpFolder, { glob: false });
    }, 10000);
    it('should download tgz', async () => {
        let url = 'https://registry.npmjs.org/coc-pairs/-/coc-pairs-1.2.13.tgz';
        let tmpFolder = await util_1.promisify(fs_1.default.mkdtemp)(path_1.default.join(os_1.default.tmpdir(), 'coc-test'));
        await download_1.default(url, { dest: tmpFolder, extract: 'untar' });
        let file = path_1.default.join(tmpFolder, 'package.json');
        expect(fs_1.default.existsSync(file)).toBe(true);
        await util_1.promisify(rimraf_1.default)(tmpFolder, { glob: false });
    }, 10000);
    it('should extract zip file', async () => {
        let url = 'https://codeload.github.com/chemzqm/vimrc/zip/master';
        let tmpFolder = await util_1.promisify(fs_1.default.mkdtemp)(path_1.default.join(os_1.default.tmpdir(), 'coc-test'));
        await download_1.default(url, { dest: tmpFolder, extract: 'unzip' });
        let folder = path_1.default.join(tmpFolder, 'vimrc-master');
        expect(fs_1.default.existsSync(folder)).toBe(true);
        await util_1.promisify(rimraf_1.default)(tmpFolder, { glob: false });
    }, 30000);
});
//# sourceMappingURL=fetch.test.js.map