"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const vscode_languageserver_protocol_1 = require("vscode-languageserver-protocol");
const vscode_uri_1 = require("vscode-uri");
const position_1 = require("../util/position");
const workspace_1 = tslib_1.__importDefault(require("../workspace"));
const logger = require('../util/logger')('diagnostic-collection');
class Collection {
    constructor(owner) {
        this.diagnosticsMap = new Map();
        this._onDispose = new vscode_languageserver_protocol_1.Emitter();
        this._onDidDiagnosticsChange = new vscode_languageserver_protocol_1.Emitter();
        this._onDidDiagnosticsClear = new vscode_languageserver_protocol_1.Emitter();
        this.onDispose = this._onDispose.event;
        this.onDidDiagnosticsChange = this._onDidDiagnosticsChange.event;
        this.onDidDiagnosticsClear = this._onDidDiagnosticsClear.event;
        this.name = owner;
    }
    set(entries, diagnostics) {
        if (!Array.isArray(entries)) {
            let uri = entries;
            // if called as set(uri, diagnostics)
            // -> convert into single-entry entries list
            entries = [[uri, diagnostics]];
        }
        let diagnosticsPerFile = new Map();
        for (let item of entries) {
            let [file, diagnostics] = item;
            if (diagnostics == null) {
                // clear diagnostics if entry contains null
                diagnostics = [];
            }
            else {
                diagnostics = (diagnosticsPerFile.get(file) || []).concat(diagnostics);
            }
            diagnosticsPerFile.set(file, diagnostics);
        }
        for (let item of diagnosticsPerFile) {
            let [uri, diagnostics] = item;
            uri = vscode_uri_1.URI.parse(uri).toString();
            diagnostics.forEach(o => {
                o.range = o.range || vscode_languageserver_protocol_1.Range.create(0, 0, 1, 0);
                o.message = o.message || 'Empty error message';
                if (position_1.emptyRange(o.range)) {
                    o.range.end = {
                        line: o.range.end.line,
                        character: o.range.end.character + 1
                    };
                }
                let { start, end } = o.range;
                // fix empty diagnostic at the and of line
                if (end.character == 0 && end.line - start.line == 1 && start.character > 0) {
                    // add last character when start character is end
                    let doc = workspace_1.default.getDocument(uri);
                    if (doc) {
                        let line = doc.getline(start.line);
                        if (start.character == line.length) {
                            o.range.start.character = start.character - 1;
                        }
                    }
                }
                o.source = o.source || this.name;
            });
            this.diagnosticsMap.set(uri, diagnostics);
            this._onDidDiagnosticsChange.fire(uri);
        }
        return;
    }
    delete(uri) {
        this.diagnosticsMap.delete(uri);
    }
    clear() {
        let uris = Array.from(this.diagnosticsMap.keys());
        this.diagnosticsMap.clear();
        this._onDidDiagnosticsClear.fire(uris);
    }
    forEach(callback, thisArg) {
        for (let uri of this.diagnosticsMap.keys()) {
            let diagnostics = this.diagnosticsMap.get(uri);
            callback.call(thisArg, uri, diagnostics, this);
        }
    }
    get(uri) {
        let arr = this.diagnosticsMap.get(uri);
        return arr == null ? [] : arr;
    }
    has(uri) {
        return this.diagnosticsMap.has(uri);
    }
    dispose() {
        this.clear();
        this._onDispose.fire(void 0);
        this._onDispose.dispose();
        this._onDidDiagnosticsClear.dispose();
        this._onDidDiagnosticsChange.dispose();
    }
}
exports.default = Collection;
//# sourceMappingURL=collection.js.map