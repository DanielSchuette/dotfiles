"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const stream_1 = require("stream");
const vscode_jsonrpc_1 = require("vscode-jsonrpc");
const vscode_languageserver_protocol_1 = require("vscode-languageserver-protocol");
const vscode_languageserver_types_1 = require("vscode-languageserver-types");
const client_1 = require("../../language-client/client");
class TestStream extends stream_1.Duplex {
    _write(chunk, _encoding, done) {
        this.emit('data', chunk);
        done();
    }
    _read(_size) {
    }
}
let serverConnection;
let clientConnection;
let progressType = new vscode_jsonrpc_1.ProgressType();
beforeEach(() => {
    const up = new TestStream();
    const down = new TestStream();
    const logger = new client_1.NullLogger();
    serverConnection = vscode_languageserver_protocol_1.createProtocolConnection(new vscode_languageserver_protocol_1.StreamMessageReader(up), new vscode_languageserver_protocol_1.StreamMessageWriter(down), logger);
    clientConnection = vscode_languageserver_protocol_1.createProtocolConnection(new vscode_languageserver_protocol_1.StreamMessageReader(down), new vscode_languageserver_protocol_1.StreamMessageWriter(up), logger);
    serverConnection.listen();
    clientConnection.listen();
});
afterEach(() => {
    serverConnection.dispose();
    clientConnection.dispose();
});
describe('Connection Tests', () => {
    it('should ensure proper param passing', async () => {
        let paramsCorrect = false;
        serverConnection.onRequest(vscode_languageserver_protocol_1.InitializeRequest.type, params => {
            paramsCorrect = !Array.isArray(params);
            let result = {
                capabilities: {}
            };
            return result;
        });
        const init = {
            rootUri: 'file:///home/dirkb',
            processId: 1,
            capabilities: {},
            workspaceFolders: null,
        };
        await clientConnection.sendRequest(vscode_languageserver_protocol_1.InitializeRequest.type, init);
        expect(paramsCorrect).toBe(true);
    });
    it('should provid token', async () => {
        serverConnection.onRequest(vscode_languageserver_protocol_1.DocumentSymbolRequest.type, params => {
            expect(params.partialResultToken).toBe('3b1db4c9-e011-489e-a9d1-0653e64707c2');
            return [];
        });
        const params = {
            textDocument: { uri: 'file:///abc.txt' },
            partialResultToken: '3b1db4c9-e011-489e-a9d1-0653e64707c2'
        };
        await clientConnection.sendRequest(vscode_languageserver_protocol_1.DocumentSymbolRequest.type, params);
    });
    it('should report result', async () => {
        let result = {
            name: 'abc',
            kind: vscode_languageserver_types_1.SymbolKind.Class,
            location: {
                uri: 'file:///abc.txt',
                range: { start: { line: 0, character: 1 }, end: { line: 2, character: 3 } }
            }
        };
        serverConnection.onRequest(vscode_languageserver_protocol_1.DocumentSymbolRequest.type, params => {
            expect(params.partialResultToken).toBe('3b1db4c9-e011-489e-a9d1-0653e64707c2');
            serverConnection.sendProgress(progressType, params.partialResultToken, [result]);
            return [];
        });
        const params = {
            textDocument: { uri: 'file:///abc.txt' },
            partialResultToken: '3b1db4c9-e011-489e-a9d1-0653e64707c2'
        };
        let progressOK = false;
        clientConnection.onProgress(progressType, '3b1db4c9-e011-489e-a9d1-0653e64707c2', values => {
            progressOK = (values !== undefined && values.length === 1);
        });
        await clientConnection.sendRequest(vscode_languageserver_protocol_1.DocumentSymbolRequest.type, params);
        expect(progressOK).toBeTruthy();
    });
    it('should provide workDoneToken', async () => {
        serverConnection.onRequest(vscode_languageserver_protocol_1.DocumentSymbolRequest.type, params => {
            expect(params.workDoneToken).toBe('3b1db4c9-e011-489e-a9d1-0653e64707c2');
            return [];
        });
        const params = {
            textDocument: { uri: 'file:///abc.txt' },
            workDoneToken: '3b1db4c9-e011-489e-a9d1-0653e64707c2'
        };
        await clientConnection.sendRequest(vscode_languageserver_protocol_1.DocumentSymbolRequest.type, params);
    });
    it('should report work done progress', async () => {
        serverConnection.onRequest(vscode_languageserver_protocol_1.DocumentSymbolRequest.type, params => {
            expect(params.workDoneToken).toBe('3b1db4c9-e011-489e-a9d1-0653e64707c2');
            serverConnection.sendProgress(progressType, params.workDoneToken, {
                kind: 'begin',
                title: 'progress'
            });
            serverConnection.sendProgress(progressType, params.workDoneToken, {
                kind: 'report',
                message: 'message'
            });
            serverConnection.sendProgress(progressType, params.workDoneToken, {
                kind: 'end',
                message: 'message'
            });
            return [];
        });
        const params = {
            textDocument: { uri: 'file:///abc.txt' },
            workDoneToken: '3b1db4c9-e011-489e-a9d1-0653e64707c2'
        };
        let result = '';
        clientConnection.onProgress(progressType, '3b1db4c9-e011-489e-a9d1-0653e64707c2', value => {
            result += value.kind;
        });
        await clientConnection.sendRequest(vscode_languageserver_protocol_1.DocumentSymbolRequest.type, params);
        expect(result).toBe('beginreportend');
    });
});
//# sourceMappingURL=connection.test.js.map