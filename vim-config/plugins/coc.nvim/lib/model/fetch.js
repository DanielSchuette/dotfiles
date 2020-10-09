"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveRequestOptions = exports.getAgent = void 0;
const tslib_1 = require("tslib");
const follow_redirects_1 = require("follow-redirects");
const url_1 = require("url");
const zlib_1 = tslib_1.__importDefault(require("zlib"));
const is_1 = require("../util/is");
const workspace_1 = tslib_1.__importDefault(require("../workspace"));
const querystring_1 = require("querystring");
const http_proxy_agent_1 = tslib_1.__importDefault(require("http-proxy-agent"));
const https_proxy_agent_1 = tslib_1.__importDefault(require("https-proxy-agent"));
const logger = require('../util/logger')('model-fetch');
function getSystemProxyURI(endpoint) {
    let env;
    if (endpoint.protocol === 'http:') {
        env = process.env.HTTP_PROXY || process.env.http_proxy || null;
    }
    else if (endpoint.protocol === 'https:') {
        env = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy || null;
    }
    let noProxy = process.env.NO_PROXY || process.env.no_proxy;
    if (noProxy === '*') {
        env = null;
    }
    else if (noProxy) {
        // canonicalize the hostname, so that 'oogle.com' won't match 'google.com'
        const hostname = endpoint.hostname.replace(/^\.*/, '.').toLowerCase();
        const port = endpoint.port || endpoint.protocol.startsWith('https') ? '443' : '80';
        const noProxyList = noProxy.split(',');
        for (let i = 0, len = noProxyList.length; i < len; i++) {
            let noProxyItem = noProxyList[i].trim().toLowerCase();
            // no_proxy can be granular at the port level, which complicates things a bit.
            if (noProxyItem.includes(':')) {
                let noProxyItemParts = noProxyItem.split(':', 2);
                let noProxyHost = noProxyItemParts[0].replace(/^\.*/, '.');
                let noProxyPort = noProxyItemParts[1];
                if (port === noProxyPort && hostname.endsWith(noProxyHost)) {
                    env = null;
                    break;
                }
            }
            else {
                noProxyItem = noProxyItem.replace(/^\.*/, '.');
                if (hostname.endsWith(noProxyItem)) {
                    env = null;
                    break;
                }
            }
        }
    }
    return env;
}
function getAgent(endpoint, options) {
    let proxy = options.proxyUrl || getSystemProxyURI(endpoint);
    if (proxy) {
        const proxyEndpoint = url_1.parse(proxy);
        if (!/^https?:$/.test(proxyEndpoint.protocol)) {
            return null;
        }
        let opts = {
            host: proxyEndpoint.hostname,
            port: proxyEndpoint.port ? Number(proxyEndpoint.port) : (proxyEndpoint.protocol === 'https' ? '443' : '80'),
            auth: proxyEndpoint.auth,
            rejectUnauthorized: typeof options.strictSSL === 'boolean' ? options.strictSSL : true
        };
        logger.info(`Using proxy ${proxy} from ${options.proxyUrl ? 'configuration' : 'system environment'} for ${endpoint.hostname}:`);
        return endpoint.protocol === 'http:' ? http_proxy_agent_1.default(opts) : https_proxy_agent_1.default(opts);
    }
    return null;
}
exports.getAgent = getAgent;
function resolveRequestOptions(url, options = {}) {
    let config = workspace_1.default.getConfiguration('http');
    let { data } = options;
    let dataType = getDataType(data);
    let proxyOptions = {
        proxyUrl: config.get('proxy', ''),
        strictSSL: config.get('proxyStrictSSL', true),
        proxyAuthorization: config.get('proxyAuthorization', null)
    };
    if (options.query && !url.includes('?')) {
        url = `${url}?${querystring_1.stringify(options.query)}`;
    }
    let headers = Object.assign(options.headers || {}, { 'Proxy-Authorization': proxyOptions.proxyAuthorization });
    let endpoint = url_1.parse(url);
    let agent = getAgent(endpoint, proxyOptions);
    let opts = {
        method: options.method || 'GET',
        hostname: endpoint.hostname,
        port: endpoint.port ? parseInt(endpoint.port, 10) : (endpoint.protocol === 'https:' ? 443 : 80),
        path: endpoint.path,
        agent,
        rejectUnauthorized: proxyOptions.strictSSL,
        maxRedirects: 3,
        headers: Object.assign({
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)',
            'Accept-Encoding': 'gzip, deflate'
        }, headers)
    };
    if (dataType == 'object') {
        opts.headers['Content-Type'] = 'application/json';
    }
    else if (dataType == 'string') {
        opts.headers['Content-Type'] = 'text/plain';
    }
    if (options.user && options.password) {
        opts.auth = options.user + ':' + options.password;
    }
    if (options.timeout) {
        opts.timeout = options.timeout;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return opts;
}
exports.resolveRequestOptions = resolveRequestOptions;
function request(url, data, opts, token) {
    let mod = url.startsWith('https:') ? follow_redirects_1.https : follow_redirects_1.http;
    return new Promise((resolve, reject) => {
        if (token) {
            let disposable = token.onCancellationRequested(() => {
                disposable.dispose();
                req.destroy(new Error('request aborted'));
            });
        }
        const req = mod.request(opts, res => {
            let readable = res;
            if ((res.statusCode >= 200 && res.statusCode < 300) || res.statusCode === 1223) {
                let headers = res.headers || {};
                let chunks = [];
                let contentType = headers['content-type'] || '';
                let contentEncoding = headers['content-encoding'] || '';
                if (contentEncoding === 'gzip') {
                    const unzip = zlib_1.default.createGunzip();
                    readable = res.pipe(unzip);
                }
                else if (contentEncoding === 'deflate') {
                    let inflate = zlib_1.default.createInflate();
                    res.pipe(inflate);
                    readable = inflate;
                }
                readable.on('data', chunk => {
                    chunks.push(chunk);
                });
                readable.on('end', () => {
                    let buf = Buffer.concat(chunks);
                    if (contentType.startsWith('application/json')
                        || contentType.startsWith('text/')) {
                        let ms = contentType.match(/charset=(\S+)/);
                        let encoding = ms ? ms[1] : 'utf8';
                        let rawData = buf.toString(encoding);
                        if (!contentType.includes('application/json')) {
                            resolve(rawData);
                        }
                        else {
                            try {
                                const parsedData = JSON.parse(rawData);
                                resolve(parsedData);
                            }
                            catch (e) {
                                reject(new Error(`Parse response error: ${e}`));
                            }
                        }
                    }
                    else {
                        resolve(buf);
                    }
                });
                readable.on('error', err => {
                    reject(new Error(`Unable to connect ${url}: ${err.message}`));
                });
            }
            else {
                reject(new Error(`Bad response from ${url}: ${res.statusCode}`));
            }
        });
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy(new Error(`Request timeout after ${opts.timeout}ms`));
        });
        if (data) {
            if (typeof data === 'string' || Buffer.isBuffer(data)) {
                req.write(data);
            }
            else {
                req.write(JSON.stringify(data));
            }
        }
        if (opts.timeout) {
            req.setTimeout(opts.timeout);
        }
        req.end();
    });
}
function getDataType(data) {
    if (data === null)
        return 'null';
    if (data === undefined)
        return 'undefined';
    if (typeof data == 'string')
        return 'string';
    if (Buffer.isBuffer(data))
        return 'buffer';
    if (Array.isArray(data) || is_1.objectLiteral(data))
        return 'object';
    return 'unknown';
}
/**
 * Send request to server for response, supports:
 *
 * - Send json data and parse json response.
 * - Throw error for failed response statusCode.
 * - Timeout support (no timeout by default).
 * - Send buffer (as data) and receive data (as response).
 * - Proxy support from user configuration & environment.
 * - Redirect support, limited to 3.
 * - Support of gzip & deflate response content.
 */
function fetch(url, options = {}, token) {
    let opts = resolveRequestOptions(url, options);
    return request(url, options.data, opts, token).catch(err => {
        logger.error(`Fetch error for ${url}:`, opts, err);
        if (opts.agent && opts.agent.proxy) {
            let { proxy } = opts.agent;
            throw new Error(`Request failed using proxy ${proxy.host}: ${err.message}`);
        }
        else {
            throw err;
        }
    });
}
exports.default = fetch;
//# sourceMappingURL=fetch.js.map