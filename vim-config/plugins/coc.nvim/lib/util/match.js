"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.score = void 0;
const tslib_1 = require("tslib");
const minimatch_1 = tslib_1.__importDefault(require("minimatch"));
const vscode_uri_1 = require("vscode-uri");
const platform = tslib_1.__importStar(require("./platform"));
function score(selector, uri, languageId) {
    if (Array.isArray(selector)) {
        // array -> take max individual value
        let ret = 0;
        for (const filter of selector) {
            const value = score(filter, uri, languageId);
            if (value === 10) {
                return value; // already at the highest
            }
            if (value > ret) {
                ret = value;
            }
        }
        return ret;
    }
    else if (typeof selector === 'string') {
        // short-hand notion, desugars to
        // 'fooLang' -> { language: 'fooLang'}
        // '*' -> { language: '*' }
        if (selector === '*') {
            return 5;
        }
        else if (selector === languageId) {
            return 10;
        }
        else {
            return 0;
        }
    }
    else if (selector) {
        let u = vscode_uri_1.URI.parse(uri);
        // filter -> select accordingly, use defaults for scheme
        const { language, pattern, scheme } = selector;
        let ret = 0;
        if (scheme) {
            if (scheme === u.scheme) {
                ret = 5;
            }
            else if (scheme === '*') {
                ret = 3;
            }
            else {
                return 0;
            }
        }
        if (language) {
            if (language === languageId) {
                ret = 10;
            }
            else if (language === '*') {
                ret = Math.max(ret, 5);
            }
            else {
                return 0;
            }
        }
        if (pattern) {
            let caseInsensitive = platform.isWindows || platform.isMacintosh;
            let p = caseInsensitive ? pattern.toLowerCase() : pattern;
            let f = caseInsensitive ? u.fsPath.toLowerCase() : u.fsPath;
            if (p === f || minimatch_1.default(f, p, { dot: true })) {
                ret = 5;
            }
            else {
                return 0;
            }
        }
        return ret;
    }
    else {
        return 0;
    }
}
exports.score = score;
//# sourceMappingURL=match.js.map