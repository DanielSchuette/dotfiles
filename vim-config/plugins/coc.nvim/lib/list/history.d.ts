import Prompt from './prompt';
export default class InputHistory {
    private prompt;
    private name;
    private db;
    private index;
    private loaded;
    private current;
    private historyInput;
    private key;
    constructor(prompt: Prompt, name: string);
    filter(): void;
    get curr(): string | null;
    load(input: string): void;
    add(): void;
    previous(): void;
    next(): void;
}
