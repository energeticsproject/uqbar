import {Input, Parser, PartialParse, Tree, TreeFragment} from '@lezer/common'
import {BuildOptions, buildParserFile, GenError} from '@lezer/generator'
import {LRParser} from '@lezer/lr'
import {Embedder} from './Embedder'

export class MixedParse implements PartialParse {
  advance(): Tree {
    throw new Error('Method not implemented.')
  }
  parsedPos: number
  stopAt(pos: number): void {
    throw new Error('Method not implemented.')
  }
  stoppedAt: number
  embed(parser: Parser, length: number) {}
}

export class MixedParser extends LRParser {
  createParse(
    input: Input,
    fragments: readonly TreeFragment[],
    ranges: readonly {from: number; to: number}[]
  ): PartialParse {
    throw new Error('Method not implemented.')
  }
  constructor(parserSpec: any) {
    // @ts-ignore
    super(parserSpec)
  }
  static createLRExternals(m, terms) {
    const {embedContext, embedTokenizer} = new Embedder(m, terms)
    return {embedContext, embedTokenizer}
  }
}

const {embedContext, embedTokenizer} = MixedParser.createLRExternals(() => {}, {
  Embed: undefined,
  EmbedContextual: undefined,
})

export const buildMixedParserFile = (
  grammar: string,
  options?: BuildOptions
) => {
  let {parser, terms} = buildParserFile(grammar, options)
  parser = parser.replace('@lezer/lr', '@energetics/lr-mixed')
  parser = parser.replace(/\bLRParser\b/g, 'MixedParser')
  return {parser, terms}
}

// if inner cannot continue
//   if either are strict, or outer can shift, cede control to outer
//   otherwise do the inner and outer parse concurrently, and cede control to whichever recovers fastest
