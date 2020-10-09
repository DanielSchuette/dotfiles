import { Neovim } from '@chemzqm/neovim';
import { IList, ListContext, ListOptions } from '../types';
import ListConfiguration from './configuration';
import InputHistory from './history';
import Prompt from './prompt';
import UI from './ui';
import Worker from './worker';
/**
 * Activated list session with UI and worker
 */
export default class ListSession {
    private nvim;
    private prompt;
    private list;
    readonly listOptions: ListOptions;
    private listArgs;
    private config;
    readonly history: InputHistory;
    readonly ui: UI;
    readonly worker: Worker;
    private cwd;
    private interval;
    private loadingFrame;
    private timer;
    private hidden;
    private disposables;
    private savedHeight;
    private window;
    private buffer;
    private interactiveDebounceTime;
    /**
     * Original list arguments.
     */
    private args;
    constructor(nvim: Neovim, prompt: Prompt, list: IList, listOptions: ListOptions, listArgs: string[], config: ListConfiguration);
    start(args: string[]): Promise<void>;
    reloadItems(): Promise<void>;
    call(fname: string): Promise<any>;
    chooseAction(): Promise<void>;
    doAction(name?: string): Promise<void>;
    first(): Promise<void>;
    last(): Promise<void>;
    previous(): Promise<void>;
    next(): Promise<void>;
    /**
     * list name
     */
    get name(): string;
    /**
     * Window id used by list.
     *
     * @returns {number | undefined}
     */
    get winid(): number | undefined;
    get length(): number;
    private get defaultAction();
    hide(): Promise<void>;
    toggleMode(): void;
    stop(): void;
    private resolveItem;
    showHelp(): Promise<void>;
    switchMatcher(): void;
    updateStatus(): void;
    get context(): ListContext;
    redrawItems(): void;
    onMouseEvent(key: any): Promise<void>;
    doNumberSelect(ch: string): Promise<boolean>;
    jumpBack(): void;
    resume(): Promise<void>;
    private doItemAction;
    onInputChange(): void;
    dispose(): void;
}
