import { Neovim } from '@chemzqm/neovim';
import { Position } from 'vscode-languageserver-protocol';
export default class Colors {
    private nvim;
    private _enabled;
    private srcId;
    private disposables;
    private highlighters;
    constructor(nvim: Neovim);
    pickPresentation(): Promise<void>;
    pickColor(): Promise<void>;
    get enabled(): boolean;
    clearHighlight(bufnr: number): void;
    hasColor(bufnr: number): boolean;
    hasColorAtPostion(bufnr: number, position: Position): boolean;
    dispose(): void;
    highlightAll(): void;
    doHighlight(bufnr: number): Promise<void>;
    private createHighlighter;
    private currentColorInfomation;
}
