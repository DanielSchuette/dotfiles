import { NeovimClient as Neovim } from '@chemzqm/neovim';
import { CodeActionKind, Definition, DocumentLink, LocationLink, Range, SelectionRange, WorkspaceEdit } from 'vscode-languageserver-protocol';
import Document from '../model/document';
import { CodeAction, TagDefinition } from '../types';
interface SymbolInfo {
    filepath?: string;
    lnum: number;
    col: number;
    text: string;
    kind: string;
    level?: number;
    containerName?: string;
    range: Range;
    selectionRange?: Range;
}
interface CommandItem {
    id: string;
    title: string;
}
export default class Handler {
    private nvim;
    private preferences;
    private documentHighlighter;
    private hoverPosition;
    private colors;
    private hoverFactory;
    private signatureFactory;
    private refactorMap;
    private documentLines;
    private codeLensManager;
    private disposables;
    private labels;
    private selectionRange;
    private signaturePosition;
    private requestStatusItem;
    private requestTokenSource;
    private requestTimer;
    private symbolsTokenSources;
    private cachedSymbols;
    constructor(nvim: Neovim);
    private withRequestToken;
    getCurrentFunctionSymbol(): Promise<string>;
    hasProvider(id: string): Promise<boolean>;
    onHover(): Promise<boolean>;
    gotoDefinition(openCommand?: string): Promise<boolean>;
    gotoDeclaration(openCommand?: string): Promise<boolean>;
    gotoTypeDefinition(openCommand?: string): Promise<boolean>;
    gotoImplementation(openCommand?: string): Promise<boolean>;
    gotoReferences(openCommand?: string, includeDeclaration?: boolean): Promise<boolean>;
    getDocumentSymbols(doc: Document | null): Promise<SymbolInfo[]>;
    getWordEdit(): Promise<WorkspaceEdit>;
    rename(newName?: string): Promise<boolean>;
    documentFormatting(): Promise<boolean>;
    documentRangeFormatting(mode: string): Promise<number>;
    getTagList(): Promise<TagDefinition[] | null>;
    runCommand(id?: string, ...args: any[]): Promise<any>;
    getCodeActions(doc: Document, range?: Range, only?: CodeActionKind[]): Promise<CodeAction[]>;
    doCodeAction(mode: string | null, only?: CodeActionKind[] | string): Promise<void>;
    /**
     * Get current codeActions
     *
     * @public
     * @returns {Promise<CodeAction[]>}
     */
    getCurrentCodeActions(mode?: string, only?: CodeActionKind[]): Promise<CodeAction[]>;
    /**
     * Invoke preferred quickfix at current position, return false when failed
     *
     * @returns {Promise<boolean>}
     */
    doQuickfix(): Promise<boolean>;
    applyCodeAction(action: CodeAction): Promise<void>;
    doCodeLensAction(): Promise<void>;
    fold(kind?: string): Promise<boolean>;
    pickColor(): Promise<void>;
    pickPresentation(): Promise<void>;
    highlight(): Promise<void>;
    getSymbolsRanges(): Promise<Range[]>;
    links(): Promise<DocumentLink[]>;
    openLink(): Promise<boolean>;
    getCommands(): Promise<CommandItem[]>;
    selectSymbolRange(inner: boolean, visualmode: string, supportedSymbols: string[]): Promise<void>;
    private tryFormatOnType;
    private triggerSignatureHelp;
    showSignatureHelp(): Promise<boolean>;
    findLocations(id: string, method: string, params: any, openCommand?: string | false): Promise<void>;
    handleLocations(definition: Definition | LocationLink[], openCommand?: string | false): Promise<void>;
    getSelectionRanges(): Promise<SelectionRange[] | null>;
    selectRange(visualmode: string, forward: boolean): Promise<void>;
    codeActionRange(start: number, end: number, only?: string): Promise<void>;
    /**
     * Refactor of current symbol
     */
    doRefactor(): Promise<void>;
    saveRefactor(bufnr: number): Promise<void>;
    search(args: string[]): Promise<void>;
    private previewHover;
    private getPreferences;
    private getCurrentState;
    dispose(): void;
}
export {};