import {NodeProp, Parser, Tree} from '@lezer/common'
import {ExternalTokenizer, InputStream, LRParser, Stack} from '@lezer/lr'
import {constants} from '@lezer/lr'
import {Parse} from '@lezer/lr/dist/parse'
const {Action, ParseState, Seq} = constants

const verbose =
  typeof process != 'undefined' && /\bparse_embed\b/.test(process.env.LOG)

export class EmbedTokenizer {
  embedContext: NodeProp<true>
  embedTokenizer: ExternalTokenizer
  constructor(
    readonly embed: (
      input: InputStream,
      stack: Stack,
      context?: number[]
    ) => LRParser | void,
    readonly terms: {Embed: number; EmbedContextual: number}
  ) {
    this.embedContext = new NodeProp({deserialize: () => true})
    this.embedTokenizer = new ExternalTokenizer((input, stack: Stack) => {
      let context: number[]
      if (terms.EmbedContextual && stack.canShift(terms.EmbedContextual)) {
        context = this.getEmbedContext(stack)
      }
      let parser = embed(input, stack, context)
      if (!parser) return
      let parse = stack.p as any
      if (!parse.subtrees) parse.subtrees = {}
      parse.subtrees[stack.pos] = parser
      let length = this.getEmbedTokenLength(stack, parser)
      input.advance(length)
      input.acceptToken(context ? terms.EmbedContextual : terms.Embed)
    })
  }

  // adapted from parse.hasAction
  // returns pairs like [action0, term0, action1, term1, action2, term2...]
  getActions(stack: any) {
    let state = stack.state
    let parser = stack.p.parser
    let data = parser.data
    let actions: number[] = []
    let defaultReduce = parser.stateSlot(state, ParseState.DefaultReduce)
    if (defaultReduce > 0) {
      return [defaultReduce, -1]
    }
    for (
      let i = parser.stateSlot(state, ParseState.Actions), next: number;
      ;
      i += 3
    ) {
      if ((next = data[i]) == Seq.End) {
        // TODO: handle skipped reduce
        if (data[i + 1] == Seq.Next) next = data[(i = pair(data, i + 2))]
        else break
      }
      actions.push(pair(data, i + 1))
      actions.push(next)
    }
    return actions
  }
  advanceToEmbedContext(stack: Stack) {
    // TODO: cache action sequence
    let parser = stack.p.parser
    let seen = new Array(parser.states.length / ParseState.Size).fill(false)
    let props = (term: number) => parser.nodeSet.types[term]?.props || {}
    let Embed = this.terms.EmbedContextual

    let first = [stack, parser.hasAction(stack.state, Embed), Embed]
    // ranked-priority search, similar-ish to A*
    let q = [[first], [], []] as [Stack, number, number][][]
    for (;;) {
      let [stack, a, t] = q[2].shift() || q[1].shift() || q[0].shift() || []
      if (!stack) {
        // TODO: warn
        return
      }
      let prestring = verbose ? 'embed: ' + stack.p.stackID(stack) : ''
      stack = stack.split() // always splits, a bit wasteful but also unavoidable
      stack.apply(a, t, stack.pos)
      if (verbose) {
        let trans = `${prestring} -> ${stack.p.stackID(stack)}`
        let aname = parser.getName(a & Action.ValueMask)
        let tname = `${parser.getName(t)} @ ${stack.pos}`
        let r = t === -1 ? 2 : +!!(a & Action.ReduceFlag)
        if (r === 2) console.log(`${trans} (always-reduce of ${aname})`)
        if (r === 1) console.log(`${trans} (reduce of ${aname} for ${tname})`)
        if (r === 0) console.log(`${trans} (shift for ${tname})`)
      }
      if (props(a & Action.ValueMask)[this.embedContext.id]) {
        return stack
      }

      let actions = this.getActions(stack)
      for (let ai = 0; ai < actions.length; ) {
        let action = actions[ai++]
        let term = actions[ai++]
        if (seen[action]) continue
        seen[action] = true
        let closes = !!props(term)[NodeProp.openedBy.id]
        let priority =
          +closes + +!!(action & Action.ReduceFlag) + +(term === -1)
        q[priority].push([stack, action, term])
      }
    }
  }
  getEmbedContext(stack: Stack) {
    // calling advanceToEmbedContext will do some shift/reduce actions,
    // which will in turn call p.stream.reset, causing this tokenizer's
    // input.acceptToken call to be ignored. here is a hack to prevent
    // that from happening
    const reset = stack.p.stream.reset
    // @ts-ignore
    stack.p.stream.reset = () => {}
    let advanced = this.advanceToEmbedContext(stack)
    stack.p.stream.reset = reset

    let size = advanced.buffer[advanced.buffer.length - 1]
    let embedContext = new Array(size) as number[]
    for (let i = embedContext.length, j = advanced.buffer.length; i > 0; ) {
      embedContext[--i] = advanced.buffer[--j]
      embedContext[--i] = advanced.buffer[--j]
      embedContext[--i] = advanced.buffer[--j]
      embedContext[--i] = advanced.buffer[--j]
      if (j === 0) {
        if (!advanced.parent) break
        advanced = advanced.parent
        j = advanced.buffer.length
      }
    }

    return embedContext
  }
  getEmbedTokenLength = (stack: Stack, parser: Parser) => {
    // @ts-ignore
    let str: string = stack.p.input.string.slice(stack.pos)
    let length = 0
    let partial = parser.startParse(str) as Parse
    for (;;) {
      try {
        let tree = partial.advance()
        // @ts-ignore
        let p = partial.baseParse || partial.baseTree || partial
        if (p.recovering) break
        length = p.minStackPos || p.length
        if (tree) break
      } catch (e) {
        break
      }
    }
    return length
  }
}

function pair(data: Readonly<Uint16Array>, off: number) {
  return data[off] | (data[off + 1] << 16)
}
