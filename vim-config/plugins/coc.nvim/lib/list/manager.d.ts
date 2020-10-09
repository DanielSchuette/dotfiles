import { Neovim } from '@chemzqm/neovim';
import { Disposable } from 'vscode-languageserver-protocol';
import { IList, ListOptions } from '../types';
import ListConfiguration from './configuration';
import Prompt from './prompt';
import ListSession from './session';
export declare class ListManager implements Disposable {
    prompt: Prompt;
    config: ListConfiguration;
    private nvim;
    private plugTs;
    private mappings;
    private sessionsMap;
    private lastSession;
    private disposables;
    private charMap;
    private listMap;
    init(nvim: Neovim): void;
    start(args: string[]): Promise<void>;
    private getSessionByWinid;
    private getCurrentSession;
    resume(name?: string): Promise<void>;
    doAction(name?: string): Promise<void>;
    first(name?: string): Promise<void>;
    last(name?: string): Promise<void>;
    previous(name?: string): Promise<void>;
    next(name?: string): Promise<void>;
    private getSession;
    cancel(close?: boolean): Promise<void>;
    /**
     * Clear all list sessions
     */
    reset(): Promise<void>;
    switchMatcher(): void;
    togglePreview(): Promise<void>;
    chooseAction(): Promise<void>;
    parseArgs(args: string[]): {
        list: IList;
        options: ListOptions;
        listArgs: string[];
    } | null;
    private onInputChar;
    private onInsertInput;
    private onNormalInput;
    onMouseEvent(key: any): Promise<void>;
    feedkeys(key: string, remap?: boolean): Promise<void>;
    command(command: string): Promise<void>;
    normal(command: string, bang?: boolean): Promise<void>;
    call(fname: string): Promise<any>;
    get session(): ListSession | undefined;
    registerList(list: IList): Disposable;
    get names(): string[];
    get descriptions(): {
        [name: string]: string;
    };
    /**
     * Get items of {name} list, not work with interactive list and list return task.
     *
     * @param {string} name
     * @returns {Promise<any>}
     */
    loadItems(name: string): Promise<any>;
    toggleMode(): void;
    get isActivated(): boolean;
    stop(): void;
    private getCharMap;
    dispose(): void;
}
declare const _default: ListManager;
export default _default;
