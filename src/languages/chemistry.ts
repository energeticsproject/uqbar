import {createLRParser, getLRParserTerms, parseMixedSubtrees} from '../utils'
import {Embedder} from '../Embedder'
import grammar from './chemistry.grammar'
import javascript from './javascript'

const {Embed, EmbedContextual} = getLRParserTerms(grammar).byName

const {embedContext, embedTokenizer} = new Embedder(
  (input, stack, context) => {
    // !!! COOL STUFF HERE !!!
    return javascript
  },
  {Embed, EmbedContextual}
)

const externals = {embedTokenizer}
const config = {wrap: parseMixedSubtrees}

export const parser = createLRParser(grammar, externals).configure(config)

export default parser
