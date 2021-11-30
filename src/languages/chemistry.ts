import {parseMixed} from '@lezer/common'
import {createLRParser, getLRParserTerms} from '../createLRParser'
import {Embedder} from '../Embedder'
import grammar from './chemistry.grammar'
import javascript from './javascript'

const {Embed, EmbedContextual} = getLRParserTerms(grammar).byName

const {embedContext, embedTokenizer} = new Embedder(
  (input, stack, context) => {
    return javascript
  },
  {Embed, EmbedContextual}
)

export const parser = createLRParser(grammar, {embedTokenizer}).configure({
  wrap: (parse, input, fragments, ranges) => {
    return parseMixed((node) => {
      if (node.name == 'Embed' || node.name == 'EmbedContextual') {
        return {parser: (parse as any).subtrees?.[node.from]}
      }
      return null
    })(parse, input, fragments, ranges)
  },
})
export default parser
