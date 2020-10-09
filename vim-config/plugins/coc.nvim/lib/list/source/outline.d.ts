import Document from '../../model/document';
import { ListContext, ListItem, ListArgument } from '../../types';
import LocationList from './location';
import { CancellationToken } from 'vscode-languageserver-protocol';
export default class Outline extends LocationList {
    readonly description = "symbols of current document";
    name: string;
    options: ListArgument[];
    loadItems(context: ListContext, token: CancellationToken): Promise<ListItem[]>;
    doHighlight(): void;
    loadCtagsSymbols(document: Document): Promise<ListItem[]>;
}
