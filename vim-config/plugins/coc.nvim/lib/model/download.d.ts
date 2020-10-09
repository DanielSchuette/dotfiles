import { DownloadOptions } from '../types';
import { CancellationToken } from 'vscode-languageserver-protocol';
/**
 * Download file from url, with optional untar/unzip support.
 *
 * @param {string} url
 * @param {DownloadOptions} options contains dest folder and optional onProgress callback
 */
export default function download(url: string, options: DownloadOptions, token?: CancellationToken): Promise<string>;
