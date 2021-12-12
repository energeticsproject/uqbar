import shajs from 'sha.js'
import * as lr from '@lezer/lr'
import * as common from '@lezer/common'
import {parseMixed} from '@lezer/common'
import {GenError, buildParserFile} from '@lezer/generator'
import {getCached} from './utils.node'

const toJS = (grammar: string) => {
  let hash = shajs('sha256').update(grammar).digest('hex')
  let result = getCached(hash, () => {
    let result = {
      parser: null as string,
      terms: null as string,
      error: null as string,
      warnings: [] as string[],
    }
    try {
      let warn = (msg: string) => result.warnings.push(msg)
      let moduleStyle = 'cjs'
      let options = {warn, moduleStyle, includeNames: true}
      Object.assign(result, buildParserFile(grammar, options))
    } catch (e) {
      result.error = e instanceof GenError ? e.message : e.stack
    }
    return result
  })

  return result
}

const defaultExternals = {
  '@lezer/lr': lr,
  '@lezer/common': common,
}

const runJS = (src: string, externals?: any) => {
  src =
    'module = {}\n' +
    'exports = {}\n' +
    src +
    '\n' +
    'return module.exports || exports\n'
  let require = (path: string) => defaultExternals[path] ?? externals
  let out = new Function('require', src)(require)
  return out
}

export const getLRParserTerms = (grammar: string) => {
  let js = toJS(grammar)
  if (js.error) {
    console.error(js.error)
    process.exit(1)
  }

  let externals = new Proxy(
    {},
    {get: () => new common.NodeProp({deserialize: (v) => v})}
  )
  let parser: lr.LRParser = runJS(js.parser, externals).parser
  let terms = {
    byName: {} as Record<string, number>,
    byId: [] as Record<number, string>,
  }
  for (let id in parser?.termNames) {
    let name = parser?.termNames[id]
    terms.byName[name] = +id
    terms.byId[id] = name
  }
  return terms
}

type ExternalSpecializer = (value: string, stack: lr.Stack) => number
type External =
  | lr.ExternalTokenizer
  | ExternalSpecializer
  | common.NodeProp<any>
  | lr.ContextTracker<any>

export const createLRParser = (
  grammar: string,
  externals: Record<string, External>
) => {
  let js = toJS(grammar)
  for (let w of js.warnings) console.warn(w)
  if (js.error) {
    console.error(js.error)
    process.exit(1)
  }

  const reg = /{([^}]+)}\s*=\s*require\(['"]([^'"]+)['"]\)/g
  for (let [, imports, path] of js.parser.matchAll(reg)) {
    if (defaultExternals[path]) continue
    for (let i of imports.split(',')) {
      i = i.trim()
      if (!externals[i]) console.warn(`Missing external '${i}'`)
    }
  }

  let parser: lr.LRParser = runJS(js.parser, externals).parser
  return parser
}

export const parseMixedSubtrees = (
  parse: common.PartialParse,
  input: common.Input,
  fragments: readonly common.TreeFragment[],
  ranges: readonly {from: number; to: number}[]
) => {
  return parseMixed((node) => {
    if (node.name == 'Embed' || node.name == 'EmbedContextual') {
      return {parser: (parse as any).subtrees?.[node.from]}
    }
    return null
  })(parse, input, fragments, ranges)
}

export const printBuffer = (buffer: number[], grammar: string) => {
  let terms = getLRParserTerms(grammar).byId
  let printed = ''
  for (let i = 0; i < buffer.length; i += 4) {
    let [term, start, end, size] = buffer.slice(i, i + 4)
    printed += `${terms[term]}[${start}:${end}] ${size / 4}\n`
  }
  return printed
}
