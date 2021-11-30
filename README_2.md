Hi, just wanted to share something I've been working on (github.com/energeticsproject/uqbar).

OK, so here's a simple grammar:

<details open>
<summary>Simple Grammar</summary>

```grammar
@top Reaction { reaction }

@skip { space }

reaction {
  Reagents { Substance ("+" Substance)* } "->"
  Products { Substance ("+" Substance)* } "~"
  Rate { Embed }
}

@external tokens embedTokenizer from "./tokens" { Embed }

@tokens {
  Substance { $[a-zA-Z_] $[a-zA-Z_0-9]* }
  space { $[ \t\n\r]+ }
}

@detectDelim
```

</details>

Which, when parsing `H2O -> H2 + O ~ tempreature ** 0.5` produces this tree:

<details open>
<summary>Simple Tree</summary>

```
Reaction(
  Reagents(
    Substance("H2O")
  )
  Products(
    Substance("H2")
    Substance("O")
  )
  Rate(
    Script(
      BinaryExpression(
        VariableName("tempreature")
        ArithOp("**")
        Number("0.5")
      )
    )
  )
)
```

</details>

Where `Script(...)` is a mounted JavaScript tree. So, at first glance this may look like a trivial application of `parseMixed`. But hold on, let's take a look at the externals:

<details open>
<summary>Simple Externals</summary>

```ts
import {createLRParser, getLRParserTerms, parseMixedSubtrees} from '../utils'
import {Embedder} from '../Embedder'
import grammar from './chemistry.grammar' // the "Simple Grammar"
import javascript from './javascript'

const {Embed} = getLRParserTerms(grammar).byName

const {embedTokenizer} = new Embedder(
  (input, stack): LRParser => {
    // !!! COOL STUFF HERE !!!
    return javascript
  },
  {Embed}
)

const externals = {embedTokenizer}
const config = {wrap: parseMixedSubtrees}

export const parser = createLRParser(grammar, externals).configure(config)

export default parser
```

</details>

The call for `new Embedder()` creates an external tokenizer, and when that tokenizer is called upon by Lezer, it calls the function passed to `new Embedder()`, which may return an LRParser. If it does, the tokenizer has that LRParser grab as much valid code as it can, accepts that code as an `Embed` token and makes a record of which parser should be used for that code range. And after the parse completes, the `parseMixedSubtrees` utility mounts the subtrees.

This involves less effort than the usual approach to mixed-language parsing (figuring out what parsers to use for subtrees _after_ the base parse rather than _during_ it), since it circumvents the need to manually figure out how far the input stream should be advanced during the parse (by defaulting to _"advance past as much valid code as the inner parser can grab"_).

So far, we've reduced the effort needed to make a mixed-language parser, but haven't enabled anything particularly novel. I think embed contexts, however, do have some genuinely novel applications. Let's take a look at them.

With a modified version of the JavaScript parser, this string:

```txt
basicFunctionCall(arg) +
chemistry.reaction(H2O -> H2 + O ~ tempreature ** 0.5)
```

Produces this tree:

<details>
<summary>JavaScript Tree</summary>

```
Script(
  BinaryExpression(
    CallExpression(
      VariableName("basicFunctionCall")
      ArgList(
        "("
        VariableName("arg")
        ")"
      )
    )
    ArithOp("+")
    CallExpression(
      MemberExpression(
        VariableName("chemistry")
        "."
        PropertyName("reaction")
      )
      ArgList(
        "("
        Reaction(
          Reagents(
            Substance("H2O")
          )
          Products(
            Substance("H2")
            Substance("O")
          )
          Rate(
            Script(
              BinaryExpression(
                VariableName("tempreature")
                ArithOp("**")
                Number("0.5")
              )
            )
          )
        )
        ")"
      )
    )
  )
)
```

</details>

We see here, that the argument to `basicFunctionCall()` is parsed as JavaScript, whereas the argument to `chemistry.reaction()` uses the chemistry parser. What modifications did we need to make to the JavaScript parser in order to make this possible?

Here are the changes we made to the grammar:

<details>
<summary>JavaScript Grammar</summary>

```git
diff --git a/src/javascript.grammar b/src/javascript.grammar
index b98ca66..0b506f4 100644
--- a/src/javascript.grammar
+++ b/src/javascript.grammar
@@ -35,7 +35,7 @@

-@top Script { statement+ }
+@top Script { expressionNoComma }

 statement[@isGroup=Statement] {
   ...
-  NewExpression { kw<"new"> expressionNoComma (!newArgs TypeArgList? ArgList)? } |
+  NewExpression[embedContext=1] { kw<"new"> expressionNoComma (!newArgs TypeArgList? ArgList)? } |
   ...
-  CallExpression { expressionNoComma !call TypeArgList? ArgList } |
+  CallExpression[embedContext=1] { expressionNoComma !call TypeArgList? ArgList } |
   ...
 }

 ArgList {
-  "(" commaSep<"..."? expressionNoComma> ")"
+  "(" commaSep<(EmbedContextual | "..."? expressionNoComma)> ")"
 }

+@external tokens embedTokenizer from "./tokens" { EmbedContextual }
+@external prop embedContext from "./tokens"
```

</details>

We make use of two new externals here, the token `EmbedContextual` (which one uses the same way they would `Embed`), and the prop `embedContext`. In this example we want to pick the parser for each argument of a `CallExpression` given that `CallExpression`, so we add `EmbedContextual` to `ArgList` and the `embedContext` prop to `CallExpression`.

And here's how we define those externals:

<details open>
<summary>JavaScript Externals</summary>

```ts
const {embedContext, embedTokenizer} = new Embedder(
  (input, stack, context) => {
    let string = (stack as any).p.input.string
    let callStart = context[1]
    let arglistStart = context.slice(-8)[1]
    let call = string.slice(callStart, arglistStart)

    if (call === 'chemistry.reaction') return chemistry
  },
  {Embed, EmbedContextual}
)
```

</details>

Whenever an `EmbedContextual` token can be shifted the function passed to `new Embedder()` is called with `context` defined, which provides all the information needed to pick a relevant parser. Regarding the format of that information, `context` is a number buffer structured like so:

`[term0, start0, end0, size0, term1, start1, end1, term1, ...]`

That format is somewhat inscrutable, but the structure/meaning of these buffers can be readily revealed by a print utility like so:

<details>
<summary>Print Utility (with example output)</summary>

```ts
const printBuffer = (buffer: number[], grammar: string) => {
  let terms = getLRParserTerms(grammar).byId
  let printed = ''
  for (let i = 0; i < buffer.length; i += 4) {
    let [term, start, end, size] = buffer.slice(i, i + 4)
    printed += `${terms[term]}[${start}:${end}] ${size / 4}\n`
  }
  return printed
}
```

Example output:

```
VariableName[25:34] 1
"."[34:35] 1
PropertyName[35:43] 1
MemberExpression[25:43] 4
"("[43:44] 1
EmbedContextual[44:44] 1
")"[44:44] 1
ArgList[43:44] 4
CallExpression[25:44] 9
```

</details>

One may notice, that according to the buffer `EmbedContextual` and `")"` both have a length of zero, and therein lies a clue to the embedder's modus operandi. Whenever an `EmbedContextual` token can be shifted the embedder creates a parse fork, takes the minimum number of actions necessary to reduce a term with the `embedContext` prop, copies the buffer from that fork, and then proceeds acording to what has already been described. So part of the buffer doesn't actually come from the input at all, but is instead artificially synthesized from the parser's automaton.

And that's everything I've done so far! It's a new approach to mixed-language parsing. If you'd like to have a go with this, clone the repository at [energeticsproject/uqbar](github.com/energeticsproject/uqbar) and run the code.

Regarding the next steps I hope to fulfil the table stakes one would expect for any production-ready parser (language support, incremental parsing, error recovery, good testing, published as module). And I eventually hope to create a programming language where you can package and import syntax the same way you would with a library.

Thank you for reading! If you have the time to spare, I'd really appreciate any suggestions, ideas, feedback, clarifying questions, or other assistance you provide. If interested, go to [energeticsproject/uqbar](github.com/energeticsproject/uqbar), try it out, and let me know what you think. :)
