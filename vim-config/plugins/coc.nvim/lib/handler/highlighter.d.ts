import { Buffer, Neovim } from '@chemzqm/neovim';
import { Color, ColorInformation, Disposable, Position, Range } from 'vscode-languageserver-protocol';
export interface ColorRanges {
    color: Color;
    ranges: Range[];
}
export default class Highlighter implements Disposable {
    private nvim;
    private bufnr;
    private srcId;
    private _colors;
    private tokenSource;
    private version;
    highlight: Function & {
        clear(): void;
    };
    constructor(nvim: Neovim, bufnr: number, srcId: any);
    get buffer(): Buffer;
    get colors(): ColorInformation[];
    hasColor(): boolean;
    doHighlight(): Promise<void>;
    private addHighlight;
    private highlightColor;
    private addColors;
    private getColorRanges;
    clearHighlight(): void;
    hasColorAtPostion(position: Position): boolean;
    cancel(): void;
    dispose(): void;
}
export declare function toHexString(color: Color): string;
