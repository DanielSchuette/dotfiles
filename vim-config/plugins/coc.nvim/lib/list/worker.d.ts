import { Neovim } from '@chemzqm/neovim';
import { Event } from 'vscode-languageserver-protocol';
import { IList, ListContext, ListItem, ListItemsEvent, ListOptions } from '../types';
import Prompt from './prompt';
export interface ExtendedItem extends ListItem {
    score: number;
    matches: number[];
    filterLabel: string;
}
export interface WorkerConfiguration {
    interactiveDebounceTime: number;
    extendedSearchMode: boolean;
}
export default class Worker {
    private nvim;
    private list;
    private prompt;
    private listOptions;
    private config;
    private recentFiles;
    private _loading;
    private totalItems;
    private tokenSource;
    private _onDidChangeItems;
    private _onDidChangeLoading;
    readonly onDidChangeItems: Event<ListItemsEvent>;
    readonly onDidChangeLoading: Event<boolean>;
    constructor(nvim: Neovim, list: IList, prompt: Prompt, listOptions: ListOptions, config: WorkerConfiguration);
    private set loading(value);
    get isLoading(): boolean;
    loadItems(context: ListContext, reload?: boolean): Promise<void>;
    drawItems(): void;
    stop(): void;
    get length(): number;
    private get input();
    private getItemsHighlight;
    private filterItems;
    private getHighlights;
    private parseListItemAnsi;
    private fixLabel;
    dispose(): void;
}
