import { Neovim } from '@chemzqm/neovim';
import { Event } from 'vscode-languageserver-protocol';
import { ListMode, ListOptions, Matcher } from '../types';
import ListConfiguration from './configuration';
export default class Prompt {
    private nvim;
    private config;
    private cusorIndex;
    private _input;
    private _matcher;
    private _mode;
    private interactive;
    private requestInput;
    private _onDidChangeInput;
    readonly onDidChangeInput: Event<string>;
    constructor(nvim: Neovim, config: ListConfiguration);
    get input(): string;
    set input(str: string);
    get mode(): ListMode;
    set mode(val: ListMode);
    set matcher(val: Matcher);
    start(opts?: ListOptions): void;
    cancel(): void;
    reset(): void;
    drawPrompt(): void;
    moveLeft(): void;
    moveRight(): void;
    moveToEnd(): void;
    moveToStart(): void;
    onBackspace(): void;
    removeNext(): void;
    removeWord(): void;
    removeTail(): void;
    removeAhead(): void;
    acceptCharacter(ch: string): Promise<void>;
    insertRegister(): void;
    paste(): Promise<void>;
    eval(expression: string): Promise<void>;
    private addText;
}
