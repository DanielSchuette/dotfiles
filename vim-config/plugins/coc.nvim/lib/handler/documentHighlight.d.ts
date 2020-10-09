import { Neovim } from '@chemzqm/neovim';
import { DocumentHighlight, Position } from 'vscode-languageserver-protocol';
import Document from '../model/document';
import Colors from './colors';
export default class DocumentHighlighter {
    private nvim;
    private colors;
    private disposables;
    private tokenSource;
    constructor(nvim: Neovim, colors: Colors);
    clearHighlight(winid?: number): void;
    highlight(bufnr: number, winid: number, position: Position): Promise<void>;
    getHighlights(doc: Document | null, position: Position): Promise<DocumentHighlight[]>;
    private cancel;
    dispose(): void;
}
