"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const follow_redirects_1 = require("follow-redirects");
const uuid_1 = require("uuid");
const fs_1 = tslib_1.__importDefault(require("fs"));
const mkdirp_1 = tslib_1.__importDefault(require("mkdirp"));
const path_1 = tslib_1.__importDefault(require("path"));
const tar_1 = tslib_1.__importDefault(require("tar"));
const unzipper_1 = tslib_1.__importDefault(require("unzipper"));
const fetch_1 = require("./fetch");
const content_disposition_1 = tslib_1.__importDefault(require("content-disposition"));
const logger = require('../util/logger')('model-download');
/**
 * Download file from url, with optional untar/unzip support.
 *
 * @param {string} url
 * @param {DownloadOptions} options contains dest folder and optional onProgress callback
 */
function download(url, options, token) {
    let { dest, onProgress, extract } = options;
    if (!dest || !path_1.default.isAbsolute(dest)) {
        throw new Error(`Expect absolute file path for dest option.`);
    }
    let stat;
    try {
        stat = fs_1.default.statSync(dest);
    }
    catch (_e) {
        mkdirp_1.default.sync(dest);
    }
    if (stat && !stat.isDirectory()) {
        throw new Error(`${dest} exists, but not directory!`);
    }
    let mod = url.startsWith('https') ? follow_redirects_1.https : follow_redirects_1.http;
    let opts = fetch_1.resolveRequestOptions(url, options);
    let extname = path_1.default.extname(url);
    return new Promise((resolve, reject) => {
        if (token) {
            let disposable = token.onCancellationRequested(() => {
                disposable.dispose();
                req.destroy(new Error('request aborted'));
            });
        }
        const req = mod.request(opts, (res) => {
            var _a;
            if ((res.statusCode >= 200 && res.statusCode < 300) || res.statusCode === 1223) {
                let headers = res.headers || {};
                let dispositionHeader = headers['content-disposition'];
                if (!extname && dispositionHeader) {
                    let disposition = content_disposition_1.default.parse(dispositionHeader);
                    if ((_a = disposition.parameters) === null || _a === void 0 ? void 0 : _a.filename) {
                        extname = path_1.default.extname(disposition.parameters.filename);
                    }
                }
                if (extract === true) {
                    if (extname === '.zip' || headers['content-type'] == 'application/zip') {
                        extract = 'unzip';
                    }
                    else if (extname == '.tgz') {
                        extract = 'untar';
                    }
                    else {
                        reject(new Error(`Unable to extract for ${url}`));
                        return;
                    }
                }
                let total = Number(headers['content-length']);
                let cur = 0;
                if (!isNaN(total)) {
                    res.on('data', chunk => {
                        cur += chunk.length;
                        let percent = (cur / total * 100).toFixed(1);
                        if (onProgress) {
                            onProgress(percent);
                        }
                        else {
                            logger.info(`Download ${url} progress ${percent}%`);
                        }
                    });
                }
                res.on('error', err => {
                    reject(new Error(`Unable to connect ${url}: ${err.message}`));
                });
                res.on('end', () => {
                    logger.info('Download completed:', url);
                });
                let stream;
                if (extract === 'untar') {
                    stream = res.pipe(tar_1.default.x({ strip: 1, C: dest }));
                }
                else if (extract === 'unzip') {
                    stream = res.pipe(unzipper_1.default.Extract({ path: dest }));
                }
                else {
                    dest = path_1.default.join(dest, `${uuid_1.v1()}${extname}`);
                    stream = res.pipe(fs_1.default.createWriteStream(dest));
                }
                stream.on('finish', () => {
                    logger.info(`Downloaded ${url} => ${dest}`);
                    setTimeout(() => {
                        resolve(dest);
                    }, 100);
                });
                stream.on('error', reject);
            }
            else {
                reject(new Error(`Invalid response from ${url}: ${res.statusCode}`));
            }
        });
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy(new Error(`request timeout after ${options.timeout}ms`));
        });
        if (options.timeout) {
            req.setTimeout(options.timeout);
        }
        req.end();
    });
}
exports.default = download;
//# sourceMappingURL=download.js.map