import { NeovimClient as Neovim } from '@chemzqm/neovim';
import { CreateFileOptions, DeleteFileOptions, Disposable, DocumentSelector, Event, FormattingOptions, Location, LocationLink, Position, Range, RenameFileOptions, WorkspaceEdit, WorkspaceFolder, WorkspaceFoldersChangeEvent } from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import Configurations from './configuration';
import DB from './model/db';
import Document from './model/document';
import FileSystemWatcher from './model/fileSystemWatcher';
import Mru from './model/mru';
import Task from './model/task';
import { TextDocumentContentProvider } from './provider';
import { Autocmd, ConfigurationChangeEvent, ConfigurationTarget, DidChangeTextDocumentParams, EditerState, Env, IWorkspace, KeymapOption, MapMode, MsgTypes, OpenTerminalOption, OutputChannel, PatternType, QuickfixItem, StatusBarItem, StatusItemOption, Terminal, TerminalOptions, TerminalResult, TextDocumentWillSaveEvent, WorkspaceConfiguration } from './types';
export declare class Workspace implements IWorkspace {
    readonly nvim: Neovim;
    readonly version: string;
    readonly keymaps: Map<string, [Function, boolean]>;
    bufnr: number;
    private mutex;
    private maxFileSize;
    private resolver;
    private rootPatterns;
    private _workspaceFolders;
    private messageLevel;
    private willSaveUntilHandler;
    private statusLine;
    private menu;
    private _insertMode;
    private _env;
    private _root;
    private _cwd;
    private _initialized;
    private _attached;
    private buffers;
    private autocmdMaxId;
    private autocmds;
    private terminals;
    private creatingSources;
    private outputChannels;
    private schemeProviderMap;
    private namespaceMap;
    private disposables;
    private watchedOptions;
    private _dynAutocmd;
    private _disposed;
    private _onDidOpenDocument;
    private _onDidCloseDocument;
    private _onDidChangeDocument;
    private _onWillSaveDocument;
    private _onDidSaveDocument;
    private _onDidChangeWorkspaceFolders;
    private _onDidChangeConfiguration;
    private _onDidWorkspaceInitialized;
    private _onDidOpenTerminal;
    private _onDidCloseTerminal;
    private _onDidRuntimePathChange;
    readonly onDidCloseTerminal: Event<Terminal>;
    readonly onDidOpenTerminal: Event<Terminal>;
    readonly onDidChangeWorkspaceFolders: Event<WorkspaceFoldersChangeEvent>;
    readonly onDidOpenTextDocument: Event<TextDocument>;
    readonly onDidCloseTextDocument: Event<TextDocument>;
    readonly onDidChangeTextDocument: Event<DidChangeTextDocumentParams>;
    readonly onWillSaveTextDocument: Event<TextDocumentWillSaveEvent>;
    readonly onDidSaveTextDocument: Event<TextDocument>;
    readonly onDidChangeConfiguration: Event<ConfigurationChangeEvent>;
    readonly onDidWorkspaceInitialized: Event<void>;
    readonly onDidRuntimePathChange: Event<string[]>;
    readonly configurations: Configurations;
    constructor();
    init(): Promise<void>;
    getConfigFile(target: ConfigurationTarget): string;
    /**
     * Register autocmd on vim.
     */
    registerAutocmd(autocmd: Autocmd): Disposable;
    /**
     * Watch for option change.
     */
    watchOption(key: string, callback: (oldValue: any, newValue: any) => Thenable<void> | void, disposables?: Disposable[]): void;
    /**
     * Watch global variable, works on neovim only.
     */
    watchGlobal(key: string, callback?: (oldValue: any, newValue: any) => Thenable<void> | void, disposables?: Disposable[]): void;
    get cwd(): string;
    get env(): Env;
    get root(): string;
    get rootPath(): string;
    get workspaceFolders(): WorkspaceFolder[];
    /**
     * uri of current file, could be null
     */
    get uri(): string;
    get workspaceFolder(): WorkspaceFolder;
    openLocalConfig(): Promise<void>;
    get textDocuments(): TextDocument[];
    get documents(): Document[];
    createNameSpace(name?: string): number;
    get channelNames(): string[];
    get pluginRoot(): string;
    get isVim(): boolean;
    get isNvim(): boolean;
    get completeOpt(): string;
    get initialized(): boolean;
    get ready(): Promise<void>;
    /**
     * Current filetypes.
     */
    get filetypes(): Set<string>;
    /**
     * Check if selector match document.
     */
    match(selector: DocumentSelector, document: TextDocument): number;
    /**
     * Findup for filename or filenames from current filepath or root.
     */
    findUp(filename: string | string[]): Promise<string | null>;
    resolveRootFolder(uri: URI, patterns: string[]): Promise<string>;
    /**
     * Create a FileSystemWatcher instance,
     * doesn't fail when watchman not found.
     */
    createFileSystemWatcher(globPattern: string, ignoreCreate?: boolean, ignoreChange?: boolean, ignoreDelete?: boolean): FileSystemWatcher;
    getWatchmanPath(): string | null;
    /**
     * Get configuration by section and optional resource uri.
     */
    getConfiguration(section?: string, resource?: string): WorkspaceConfiguration;
    /**
     * Get created document by uri or bufnr.
     */
    getDocument(uri: number | string): Document;
    /**
     * Get current cursor offset in document.
     */
    getOffset(): Promise<number>;
    /**
     * Apply WorkspaceEdit.
     */
    applyEdit(edit: WorkspaceEdit): Promise<boolean>;
    /**
     * Convert location to quickfix item.
     */
    getQuickfixItem(loc: Location | LocationLink, text?: string, type?: string, module?: string): Promise<QuickfixItem>;
    /**
     * Create persistence Mru instance.
     */
    createMru(name: string): Mru;
    /**
     * Get selected range for current document
     */
    getSelectedRange(mode: string, document: Document): Promise<Range | null>;
    /**
     * Visual select range of current document
     */
    selectRange(range: Range): Promise<void>;
    /**
     * Populate locations to UI.
     */
    showLocations(locations: Location[]): Promise<void>;
    /**
     * Get content of line by uri and line.
     */
    getLine(uri: string, line: number): Promise<string>;
    /**
     * Get position for matchaddpos from range & uri
     */
    getHighlightPositions(uri: string, range: Range): Promise<[number, number, number][]>;
    /**
     * Get WorkspaceFolder of uri
     */
    getWorkspaceFolder(uri: string): WorkspaceFolder | null;
    /**
     * Get content from buffer of file by uri.
     */
    readFile(uri: string): Promise<string>;
    getFilepath(filepath: string): string;
    onWillSaveUntil(callback: (event: TextDocumentWillSaveEvent) => void, thisArg: any, clientId: string): Disposable;
    /**
     * Echo lines.
     */
    echoLines(lines: string[], truncate?: boolean): Promise<void>;
    /**
     * Show message in vim.
     */
    showMessage(msg: string, identify?: MsgTypes): void;
    /**
     * Current document.
     */
    get document(): Promise<Document>;
    /**
     * Get current cursor position.
     */
    getCursorPosition(): Promise<Position>;
    /**
     * Get current document and position.
     */
    getCurrentState(): Promise<EditerState>;
    /**
     * Get format options
     */
    getFormatOptions(uri?: string): Promise<FormattingOptions>;
    /**
     * Jump to location.
     */
    jumpTo(uri: string, position?: Position | null, openCommand?: string): Promise<void>;
    /**
     * Move cursor to position.
     */
    moveTo(position: Position): Promise<void>;
    /**
     * Create a file in vim and disk
     */
    createFile(filepath: string, opts?: CreateFileOptions): Promise<void>;
    /**
     * Load uri as document.
     */
    loadFile(uri: string): Promise<Document>;
    /**
     * Load the files that not loaded
     */
    loadFiles(uris: string[]): Promise<void>;
    /**
     * Rename file in vim and disk
     */
    renameFile(oldPath: string, newPath: string, opts?: RenameFileOptions): Promise<void>;
    /**
     * Delete file from vim and disk.
     */
    deleteFile(filepath: string, opts?: DeleteFileOptions): Promise<void>;
    /**
     * Open resource by uri
     */
    openResource(uri: string): Promise<void>;
    /**
     * Create a new output channel
     */
    createOutputChannel(name: string): OutputChannel;
    /**
     * Reveal buffer of output channel.
     */
    showOutputChannel(name: string, preserveFocus?: boolean): void;
    /**
     * Resovle module from yarn or npm.
     */
    resolveModule(name: string): Promise<string>;
    /**
     * Run nodejs command
     */
    runCommand(cmd: string, cwd?: string, timeout?: number): Promise<string>;
    /**
     * Run command in vim terminal for result
     */
    runTerminalCommand(cmd: string, cwd?: string, keepfocus?: boolean): Promise<TerminalResult>;
    /**
     * Open terminal buffer with cmd & opts
     */
    openTerminal(cmd: string, opts?: OpenTerminalOption): Promise<number>;
    /**
     * Expand filepath with `~` and/or environment placeholders
     */
    expand(filepath: string): string;
    createTerminal(opts: TerminalOptions): Promise<Terminal>;
    /**
     * Show quickpick
     */
    showQuickpick(items: string[], placeholder?: string): Promise<number>;
    /**
     * Prompt for confirm action.
     */
    showPrompt(title: string): Promise<boolean>;
    callAsync<T>(method: string, args: any[]): Promise<T>;
    /**
     * Request input from user
     */
    requestInput(title: string, defaultValue?: string): Promise<string>;
    /**
     * registerTextDocumentContentProvider
     */
    registerTextDocumentContentProvider(scheme: string, provider: TextDocumentContentProvider): Disposable;
    /**
     * Register unique keymap uses `<Plug>(coc-{key})` as lhs
     * Throw error when {key} already exists.
     *
     * @param {MapMode[]} modes - array of 'n' | 'i' | 'v' | 'x' | 's' | 'o'
     * @param {string} key - unique name
     * @param {Function} fn - callback function
     * @param {Partial} opts
     * @returns {Disposable}
     */
    registerKeymap(modes: MapMode[], key: string, fn: Function, opts?: Partial<KeymapOption>): Disposable;
    /**
     * Register expr keymap.
     */
    registerExprKeymap(mode: 'i' | 'n' | 'v' | 's' | 'x', key: string, fn: Function, buffer?: boolean): Disposable;
    registerLocalKeymap(mode: 'n' | 'v' | 's' | 'x', key: string, fn: Function, notify?: boolean): Disposable;
    /**
     * Create StatusBarItem
     */
    createStatusBarItem(priority?: number, opt?: StatusItemOption): StatusBarItem;
    dispose(): void;
    detach(): Promise<void>;
    /**
     * Create DB instance at extension root.
     */
    createDatabase(name: string): DB;
    /**
     * Create Task instance that runs in vim.
     */
    createTask(id: string): Task;
    setupDynamicAutocmd(initialize?: boolean): void;
    private onBufReadCmd;
    attach(): Promise<void>;
    private getChangedUris;
    private createConfigurations;
    private attachChangedEvents;
    private onBufCreate;
    private onBufEnter;
    private checkCurrentBuffer;
    private onBufWritePost;
    private onBufUnload;
    private onBufWritePre;
    private onDirChanged;
    private onFileTypeChange;
    private checkBuffer;
    private getFileEncoding;
    private resolveRoot;
    getRootPatterns(document: Document, patternType: PatternType): string[];
    renameCurrent(): Promise<void>;
    private setMessageLevel;
    get folderPaths(): string[];
    get floatSupported(): boolean;
    removeWorkspaceFolder(fsPath: string): void;
    renameWorkspaceFolder(oldPath: string, newPath: string): void;
    addRootPattern(filetype: string, rootPatterns: string[]): void;
    get insertMode(): boolean;
    private addWorkspaceFolder;
    private getServerRootPatterns;
}
declare const _default: Workspace;
export default _default;