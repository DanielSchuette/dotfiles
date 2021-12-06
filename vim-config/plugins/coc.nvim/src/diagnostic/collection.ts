import { Diagnostic, Emitter, Event, Range } from 'vscode-languageserver-protocol'
import { URI } from 'vscode-uri'
import workspace from '../workspace'
const logger = require('../util/logger')('diagnostic-collection')

export default class DiagnosticCollection {
  private diagnosticsMap: Map<string, Diagnostic[]> = new Map()
  private _onDidDiagnosticsChange = new Emitter<string>()
  public readonly onDidDiagnosticsChange: Event<string> = this._onDidDiagnosticsChange.event

  constructor(
    public readonly name: string,
    private onDispose?: () => void) {
  }

  public set(uri: string, diagnostics: Diagnostic[] | undefined): void
  public set(entries: [string, Diagnostic[] | undefined][]): void
  public set(entries: [string, Diagnostic[] | undefined][] | string, diagnostics?: Diagnostic[]): void {
    let diagnosticsPerFile: Map<string, Diagnostic[]> = new Map()
    if (!Array.isArray(entries)) {
      let doc = workspace.getDocument(entries)
      let uri = doc ? doc.uri : entries
      diagnosticsPerFile.set(uri, diagnostics || [])
    } else {
      for (let item of entries) {
        let [uri, diagnostics] = item
        let doc = workspace.getDocument(uri)
        uri = doc ? doc.uri : uri
        if (diagnostics == null) {
          // clear previous diagnostics if entry contains null
          diagnostics = []
        } else {
          diagnostics = (diagnosticsPerFile.get(uri) || []).concat(diagnostics)
        }
        diagnosticsPerFile.set(uri, diagnostics)
      }
    }
    for (let item of diagnosticsPerFile) {
      let [uri, diagnostics] = item
      uri = URI.parse(uri).toString()
      diagnostics.forEach(o => {
        // should be message for the file, but we need range
        o.range = o.range || Range.create(0, 0, 0, 0)
        o.message = o.message || ''
        o.source = o.source || this.name
      })
      this.diagnosticsMap.set(uri, diagnostics)
      this._onDidDiagnosticsChange.fire(uri)
    }
  }

  public delete(uri: string): void {
    this.diagnosticsMap.delete(uri)
    this._onDidDiagnosticsChange.fire(uri)
  }

  public clear(): void {
    let uris = this.diagnosticsMap.keys()
    this.diagnosticsMap.clear()
    for (let uri of uris) {
      this._onDidDiagnosticsChange.fire(uri)
    }
  }

  public forEach(callback: (uri: string, diagnostics: Diagnostic[], collection: DiagnosticCollection) => any, thisArg?: any): void {
    for (let uri of this.diagnosticsMap.keys()) {
      let diagnostics = this.diagnosticsMap.get(uri)
      callback.call(thisArg, uri, diagnostics, this)
    }
  }

  public get(uri: string): Diagnostic[] {
    let arr = this.diagnosticsMap.get(uri)
    return arr == null ? [] : arr
  }

  public has(uri: string): boolean {
    return this.diagnosticsMap.has(uri)
  }

  public dispose(): void {
    this.clear()
    if (this.onDispose) this.onDispose()
    this._onDidDiagnosticsChange.dispose()
  }
}
