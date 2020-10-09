"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const fs_1 = tslib_1.__importDefault(require("fs"));
const path_1 = tslib_1.__importDefault(require("path"));
const events_1 = tslib_1.__importDefault(require("../../events"));
const extensions_1 = tslib_1.__importDefault(require("../../extensions"));
const helper_1 = tslib_1.__importDefault(require("../helper"));
const uuid_1 = require("uuid");
let nvim;
beforeAll(async () => {
    await helper_1.default.setup();
    nvim = helper_1.default.nvim;
});
afterAll(async () => {
    await helper_1.default.shutdown();
});
jest.setTimeout(30000);
describe('extensions', () => {
    it('should load global extensions', async () => {
        let stat = extensions_1.default.getExtensionState('test');
        expect(stat).toBe('activated');
    });
    it('should filter global extensions', async () => {
        let res = extensions_1.default.filterGlobalExtensions(['test', 'foo']);
        expect(res).toEqual(['foo']);
    });
    it('should load local extensions from &rtp', async () => {
        let folder = path_1.default.resolve(__dirname, '../extensions/vim/local');
        await nvim.command(`set runtimepath^=${folder}`);
        await helper_1.default.wait(300);
        let stat = extensions_1.default.getExtensionState('local');
        expect(stat).toBe('activated');
    });
    it('should install/uninstall npm extension', async () => {
        await extensions_1.default.installExtensions(['coc-omni']);
        let folder = path_1.default.join(__dirname, '../extensions/coc-omni');
        let exists = fs_1.default.existsSync(folder);
        expect(exists).toBe(true);
        await helper_1.default.wait(200);
        await extensions_1.default.uninstallExtension(['coc-omni']);
        exists = fs_1.default.existsSync(folder);
        expect(exists).toBe(false);
    });
    it('should install/uninstall extension by url', async () => {
        await extensions_1.default.installExtensions(['https://github.com/hollowtree/vscode-vue-snippets']);
        let folder = path_1.default.join(__dirname, '../extensions/vue-snippets');
        let exists = fs_1.default.existsSync(folder);
        expect(exists).toBe(true);
        await extensions_1.default.uninstallExtension(['vue-snippets']);
        exists = fs_1.default.existsSync(folder);
        expect(exists).toBe(false);
    });
    it('should get all extensions', () => {
        let list = extensions_1.default.all;
        expect(Array.isArray(list)).toBe(true);
    });
    it('should get extensions stat', async () => {
        let stats = await extensions_1.default.getExtensionStates();
        expect(stats.length).toBeGreaterThan(0);
    });
    it('should toggle extension', async () => {
        await extensions_1.default.toggleExtension('test');
        let stat = extensions_1.default.getExtensionState('test');
        expect(stat).toBe('disabled');
        await extensions_1.default.toggleExtension('test');
        stat = extensions_1.default.getExtensionState('test');
        expect(stat).toBe('activated');
    });
    it('should reload extension', async () => {
        await extensions_1.default.reloadExtension('test');
        let stat = extensions_1.default.getExtensionState('test');
        expect(stat).toBe('activated');
    });
    it('should has extension', () => {
        let res = extensions_1.default.has('test');
        expect(res).toBe(true);
    });
    it('should be activated', async () => {
        let res = extensions_1.default.has('test');
        expect(res).toBe(true);
    });
    it('should activate & deactivate extension', async () => {
        await extensions_1.default.deactivate('test');
        let stat = extensions_1.default.getExtensionState('test');
        expect(stat).toBe('loaded');
        await extensions_1.default.activate('test');
        stat = extensions_1.default.getExtensionState('test');
        expect(stat).toBe('activated');
    });
    it('should call extension API', async () => {
        let res = await extensions_1.default.call('test', 'echo', ['5']);
        expect(res).toBe('5');
        let p = await extensions_1.default.call('test', 'asAbsolutePath', ['..']);
        expect(p.endsWith('extensions')).toBe(true);
    });
    it('should get extension API', () => {
        let res = extensions_1.default.getExtensionApi('test');
        expect(typeof res.echo).toBe('function');
    });
    it('should load single file extension', async () => {
        let filepath = path_1.default.join(__dirname, '../extensions/root.js');
        await extensions_1.default.loadExtensionFile(filepath);
        expect(extensions_1.default.has('single-root')).toBe(true);
    });
});
describe('extensions active events', () => {
    function createExtension(event) {
        let id = uuid_1.v1();
        let isActive = false;
        let packageJSON = {
            name: id,
            activationEvents: [event]
        };
        let ext = {
            id,
            packageJSON,
            exports: void 0,
            extensionPath: '',
            activate: async () => {
                isActive = true;
            }
        };
        Object.defineProperty(ext, 'isActive', {
            get: () => isActive
        });
        extensions_1.default.registerExtension(ext, () => {
            isActive = false;
        });
        return ext;
    }
    it('should activate on language', async () => {
        let ext = createExtension('onLanguage:javascript');
        expect(ext.isActive).toBe(false);
        await nvim.command('edit /tmp/a.js');
        await helper_1.default.wait(300);
        expect(ext.isActive).toBe(true);
        ext = createExtension('onLanguage:javascript');
        expect(ext.isActive).toBe(true);
    });
    it('should activate on command', async () => {
        let ext = createExtension('onCommand:test.echo');
        await events_1.default.fire('Command', ['test.echo']);
        await helper_1.default.wait(30);
        expect(ext.isActive).toBe(true);
    });
    it('should activate on workspace contains', async () => {
        let ext = createExtension('workspaceContains:package.json');
        let root = path_1.default.resolve(__dirname, '../../..');
        await nvim.command(`edit ${path_1.default.join(root, 'file.js')}`);
        await helper_1.default.wait(100);
        expect(ext.isActive).toBe(true);
    });
    it('should activate on file system', async () => {
        let ext = createExtension('onFileSystem:zip');
        await nvim.command('edit zip:///a');
        await helper_1.default.wait(30);
        expect(ext.isActive).toBe(true);
        ext = createExtension('onFileSystem:zip');
        expect(ext.isActive).toBe(true);
    });
});
describe('extension properties', () => {
    it('should get extensionPath', () => {
        let ext = extensions_1.default.getExtension('test');
        let p = ext.extension.extensionPath;
        expect(p.endsWith('test')).toBe(true);
    });
    it('should deactivate', async () => {
        let ext = extensions_1.default.getExtension('test');
        await ext.deactivate();
        expect(ext.extension.isActive).toBe(false);
        await extensions_1.default.activate('test');
    });
});
//# sourceMappingURL=extensions.test.js.map