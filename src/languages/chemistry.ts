import {createLRParser, getLRParserTerms, parseMixedSubtrees} from '../utils'
import {EmbedTokenizer} from '../EmbedTokenizer'
import grammar from './chemistry.grammar'
import javascript from './javascript'

const {Embed, EmbedContextual} = getLRParserTerms(grammar).byName

const {embedContext, embedTokenizer} = new EmbedTokenizer(
  (input, stack, context) => javascript,
  {Embed, EmbedContextual}
)

const externals = {embedTokenizer}
const config = {wrap: parseMixedSubtrees}

export const parser = createLRParser(grammar, externals).configure(config)

export default parser
