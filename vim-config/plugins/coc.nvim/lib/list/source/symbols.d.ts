import { ListContext, ListItem } from '../../types';
import LocationList from './location';
import { CancellationToken } from 'vscode-languageserver-protocol';
export default class Symbols extends LocationList {
    readonly interactive = true;
    readonly description = "search workspace symbols";
    readonly detail = "Symbols list is provided by server, it works on interactive mode only.";
    name: string;
    options: {
        name: string;
        description: string;
        hasValue: boolean;
    }[];
    loadItems(context: ListContext, token: CancellationToken): Promise<ListItem[]>;
    resolveItem(item: ListItem): Promise<ListItem>;
    doHighlight(): void;
}
