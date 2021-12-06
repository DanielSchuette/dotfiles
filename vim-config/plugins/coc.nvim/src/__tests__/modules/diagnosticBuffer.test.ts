import helper from '../helper'
import { Neovim } from '@chemzqm/neovim'
import { DiagnosticBuffer } from '../../diagnostic/buffer'
import { Range, DiagnosticSeverity, Diagnostic, DiagnosticTag, Position } from 'vscode-languageserver-types'
import workspace from '../../workspace'

let nvim: Neovim
const config: any = {
  autoRefresh: true,
  checkCurrentLine: false,
  locationlistUpdate: true,
  enableSign: true,
  enableHighlightLineNumber: true,
  enableMessage: 'always',
  messageTarget: 'echo',
  messageDelay: 250,
  refreshOnInsertMode: false,
  virtualTextSrcId: 99,
  virtualText: false,
  virtualTextCurrentLineOnly: true,
  virtualTextPrefix: " ",
  virtualTextLines: 3,
  virtualTextLineSeparator: " \\ ",
  displayByAle: false,
  level: DiagnosticSeverity.Hint,
  signPriority: 11,
  errorSign: '>>',
  warningSign: '>>',
  infoSign: '>>',
  hintSign: '>>',
  filetypeMap: {
    default: ''
  },
}

async function createDiagnosticBuffer(): Promise<DiagnosticBuffer> {
  let doc = await helper.createDocument()
  return new DiagnosticBuffer(nvim, doc.bufnr, doc.uri, config, () => {
    // noop
  })
}

function createDiagnostic(msg: string, range?: Range, severity?: DiagnosticSeverity, tags?: DiagnosticTag[]): Diagnostic & { collection: string } {
  range = range ? range : Range.create(0, 0, 0, 1)
  return Object.assign(Diagnostic.create(range, msg, severity || DiagnosticSeverity.Error, 999, 'test'), { collection: 'test', tags })
}

let ns: number
beforeAll(async () => {
  await helper.setup()
  nvim = helper.nvim
  ns = await nvim.createNamespace('coc-diagnostic')
})

afterAll(async () => {
  await helper.shutdown()
})

afterEach(async () => {
  await helper.reset()
})

describe('diagnostic buffer', () => {
  describe('refresh()', () => {
    it('should add signs', async () => {
      let diagnostics = [createDiagnostic('foo'), createDiagnostic('bar')]
      let buf = await createDiagnosticBuffer()
      buf.addSigns('a', diagnostics)
      await helper.wait(30)
      let res = await nvim.call('sign_getplaced', [buf.bufnr, { group: 'CocDiagnostica' }])
      let signs = res[0].signs
      expect(signs).toBeDefined()
      expect(signs[0].name).toBe('CocError')
    })

    it('should set diagnostic info', async () => {
      let r = Range.create(0, 1, 0, 2)
      let diagnostics = [
        createDiagnostic('foo', r, DiagnosticSeverity.Error),
        createDiagnostic('bar', r, DiagnosticSeverity.Warning),
        createDiagnostic('foo', r, DiagnosticSeverity.Hint),
        createDiagnostic('bar', r, DiagnosticSeverity.Information)
      ]
      let buf = await createDiagnosticBuffer()
      await buf.refresh({ '': diagnostics })
      let buffer = await nvim.buffer
      let res = await buffer.getVar('coc_diagnostic_info')
      expect(res).toEqual({
        lnums: [1, 1, 1, 1],
        information: 1,
        hint: 1,
        warning: 1,
        error: 1
      })
    })

    it('should add highlight', async () => {
      let buf = await createDiagnosticBuffer()
      let doc = workspace.getDocument(buf.bufnr)
      await nvim.setLine('abc')
      await doc.patchChange(true)
      nvim.pauseNotification()
      buf.updateHighlights('', [
        createDiagnostic('foo', Range.create(0, 0, 0, 1), DiagnosticSeverity.Error),
        createDiagnostic('bar', Range.create(0, 0, 0, 1), DiagnosticSeverity.Warning)
      ])
      await nvim.resumeNotification()
      let res = await nvim.call('nvim_buf_get_extmarks', [buf.bufnr, ns, 0, -1, { details: true }]) as any
      expect(res).toEqual([
        [
          1,
          0,
          0,
          {
            hl_group: 'CocWarningHighlight',
            priority: 4096,
            end_col: 1,
            end_row: 0
          }
        ],
        [
          2,
          0,
          0,
          {
            hl_group: 'CocErrorHighlight',
            priority: 4096,
            end_col: 1,
            end_row: 0
          }
        ]
      ])
      nvim.pauseNotification()
      buf.updateHighlights('', [])
      await nvim.resumeNotification()
      res = await nvim.call('nvim_buf_get_extmarks', [buf.bufnr, ns, 0, -1, { details: true }]) as any[]
      expect(res.length).toBe(0)
    })

    it('should add deprecated highlight', async () => {
      let diagnostic = createDiagnostic('foo', Range.create(0, 0, 0, 1), DiagnosticSeverity.Information, [DiagnosticTag.Deprecated])
      let buf = await createDiagnosticBuffer()
      let doc = workspace.getDocument(buf.bufnr)
      await nvim.setLine('foo')
      await doc.patchChange(true)
      nvim.pauseNotification()
      buf.updateHighlights('', [diagnostic])
      await nvim.resumeNotification()
      let res = await nvim.call('nvim_buf_get_extmarks', [buf.bufnr, ns, 0, -1, {}]) as [number, number, number][]
      expect(res.length).toBe(1)
    })
  })

  describe('showVirtualText()', () => {
    beforeEach(async () => {
      config.virtualText = true
      config.virtualTextSrcId = await nvim.createNamespace('diagnostics-virtualText')
    })
    afterEach(() => {
      config.virtualText = false
      config.virtualTextCurrentLineOnly = true
    })

    it('should show virtual text on current line', async () => {
      let diagnostic = createDiagnostic('foo')
      let buf = await createDiagnosticBuffer()
      let diagnostics = [diagnostic]
      await buf.refresh({ '': diagnostics })
      let ns = config.virtualTextSrcId
      let res = await nvim.call('nvim_buf_get_extmarks', [buf.bufnr, ns, 0, -1, { details: true }]) as any
      expect(res.length).toBe(1)
      let texts = res[0][3].virt_text
      expect(texts[0]).toEqual([' foo', 'CocErrorVirtualText'])
    })

    it('should virtual text on all lines', async () => {
      config.virtualTextCurrentLineOnly = false
      let buf = await createDiagnosticBuffer()
      let diagnostics = [
        createDiagnostic('foo', Range.create(0, 0, 0, 1)),
        createDiagnostic('bar', Range.create(1, 0, 1, 1)),
      ]
      await buf.refresh({ '': diagnostics })
      let ns = config.virtualTextSrcId
      let res = await nvim.call('nvim_buf_get_extmarks', [buf.bufnr, ns, 0, -1, { details: true }]) as any
      expect(res.length).toBe(2)
    })
  })

  describe('updateLocationList()', () => {
    beforeEach(async () => {
      config.locationlistUpdate = true
    })
    afterEach(() => {
      config.locationlistUpdate = false
    })

    it('should update location list', async () => {
      let buf = await createDiagnosticBuffer()
      await nvim.call('setloclist', [0, [], 'r', { title: 'Diagnostics of coc', items: [] }])
      await buf.refresh({
        a: [createDiagnostic('foo')]
      })
      let res = await nvim.eval(`getloclist(bufwinid(${buf.bufnr}))`) as any[]
      expect(res.length).toBe(1)
      expect(res[0].text).toBe('[test 999] foo [E]')
    })
  })

  describe('clear()', () => {
    let config = workspace.getConfiguration('diagnostic')
    beforeEach(() => {
      config.update('virtualText', true)
    })
    afterEach(() => {
      config.update('virtualText', false)
    })

    it('should clear all diagnostics', async () => {
      let diagnostic = createDiagnostic('foo')
      let buf = await createDiagnosticBuffer()
      let diagnostics = [diagnostic]
      await buf.refresh({ '': diagnostics })
      buf.clear()
      await helper.wait(50)
      let buffer = await nvim.buffer
      let res = await buffer.getVar("coc_diagnostic_info")
      expect(res == null).toBe(true)
    })
  })

  describe('getDiagnostics()', () => {
    it('should get sorted diagnostics', async () => {
      let buf = await createDiagnosticBuffer()
      let diagnostics = [
        createDiagnostic('three', Range.create(0, 1, 0, 2), DiagnosticSeverity.Error),
        createDiagnostic('one', Range.create(0, 0, 0, 2), DiagnosticSeverity.Warning),
        createDiagnostic('two', Range.create(0, 0, 0, 2), DiagnosticSeverity.Error),
      ]
      diagnostics[0].tags = [DiagnosticTag.Unnecessary]
      await buf.refresh({
        x: diagnostics,
        y: [createDiagnostic('four', Range.create(0, 0, 0, 2), DiagnosticSeverity.Error)]
      })
      let res = buf.getDiagnosticsAt(Position.create(0, 1), false)
      let arr = res.map(o => o.message)
      expect(arr).toEqual(['four', 'two', 'three', 'one'])
    })
  })
})
