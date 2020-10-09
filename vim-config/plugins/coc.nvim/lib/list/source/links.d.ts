import { Neovim } from '@chemzqm/neovim';
import { ListContext, ListItem } from '../../types';
import BasicList from '../basic';
import { CancellationToken } from 'vscode-languageserver-protocol';
export default class LinksList extends BasicList {
    defaultAction: string;
    description: string;
    name: string;
    constructor(nvim: Neovim);
    loadItems(context: ListContext, token: CancellationToken): Promise<ListItem[]>;
}
