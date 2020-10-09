/// <reference types="node" />
import { UrlWithStringQuery } from 'url';
import { FetchOptions } from '../types';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { CancellationToken } from 'vscode-languageserver-protocol';
export declare type ResponseResult = string | Buffer | {
    [name: string]: any;
};
export interface ProxyOptions {
    proxyUrl: string;
    strictSSL?: boolean;
    proxyAuthorization?: string | null;
}
export declare function getAgent(endpoint: UrlWithStringQuery, options: ProxyOptions): HttpsProxyAgent | HttpProxyAgent;
export declare function resolveRequestOptions(url: string, options?: FetchOptions): any;
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
export default function fetch(url: string, options?: FetchOptions, token?: CancellationToken): Promise<ResponseResult>;
