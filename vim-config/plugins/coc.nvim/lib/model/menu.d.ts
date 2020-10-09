import { Event } from 'vscode-languageserver-protocol';
import { Neovim } from '@chemzqm/neovim';
import { Env } from '../types';
export default class Menu {
    private nvim;
    private env;
    private floatFactory;
    private window;
    private _onDidChoose;
    private _onDidCancel;
    private currIndex;
    private total;
    readonly onDidChoose: Event<number>;
    readonly onDidCancel: Event<void>;
    constructor(nvim: Neovim, env: Env);
    show(items: string[]): void;
}
