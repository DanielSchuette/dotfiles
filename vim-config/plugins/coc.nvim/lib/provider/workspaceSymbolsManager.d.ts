import { CancellationToken, Disposable, SymbolInformation } from 'vscode-languageserver-protocol';
import { WorkspaceSymbolProvider } from './index';
export default class WorkspaceSymbolManager implements Disposable {
    private providers;
    register(provider: WorkspaceSymbolProvider): Disposable;
    provideWorkspaceSymbols(query: string, token: CancellationToken): Promise<SymbolInformation[]>;
    resolveWorkspaceSymbol(symbolInfo: SymbolInformation, token: CancellationToken): Promise<SymbolInformation>;
    hasProvider(): boolean;
    dispose(): void;
}
