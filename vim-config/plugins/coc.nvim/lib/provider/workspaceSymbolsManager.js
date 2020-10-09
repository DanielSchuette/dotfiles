"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const uuid_1 = require("uuid");
const vscode_languageserver_protocol_1 = require("vscode-languageserver-protocol");
class WorkspaceSymbolManager {
    constructor() {
        this.providers = new Map();
    }
    register(provider) {
        let id = uuid_1.v4();
        this.providers.set(id, provider);
        return vscode_languageserver_protocol_1.Disposable.create(() => {
            this.providers.delete(id);
        });
    }
    async provideWorkspaceSymbols(query, token) {
        let entries = Array.from(this.providers.entries());
        if (!entries.length)
            return [];
        let res = [];
        await Promise.all(entries.map(o => {
            let [id, p] = o;
            return Promise.resolve(p.provideWorkspaceSymbols(query, token)).then(item => {
                if (item) {
                    item.source = id;
                    res.push(...item);
                }
            });
        }));
        return res;
    }
    async resolveWorkspaceSymbol(symbolInfo, token) {
        let provider = this.providers.get(symbolInfo.source);
        if (!provider)
            return;
        if (typeof provider.resolveWorkspaceSymbol != 'function') {
            return Promise.resolve(symbolInfo);
        }
        return await Promise.resolve(provider.resolveWorkspaceSymbol(symbolInfo, token));
    }
    hasProvider() {
        return this.providers.size > 0;
    }
    dispose() {
        this.providers = new Map();
    }
}
exports.default = WorkspaceSymbolManager;
//# sourceMappingURL=workspaceSymbolsManager.js.map