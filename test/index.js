const {parsers, print} = require('../build/index.node.js')
const fs = require('fs')
const path = require('path')
const {fileURLToPath} = require('url')
const assert = require('assert')

let caseDir = __dirname

let getCases = (text) => {
  let cases = []
  let caseExpr =
    /\s*#\s*(.*)(?:\r\n|\r|\n)([^]*?)==+>([^]*?)(?:$|(?:\r\n|\r|\n)+(?=#))/gy
  let lastIndex = 0
  for (;;) {
    let m = caseExpr.exec(text)
    if (!m) throw new Error(`Unexpected test format`)

    let [, name, configStr] = /(.*?)(\{.*?\})?$/.exec(m[1])
    let config = configStr ? JSON.parse(configStr) : null

    let test = m[2].trim()
    let expected = m[3].trim()
    cases.push({
      name,
      config,
      test,
      expected,
    })
    lastIndex = m.index + m[0].length
    if (lastIndex == text.length) break
  }
  return cases
}

for (let file of fs.readdirSync(caseDir)) {
  if (!/\.txt$/.test(file)) continue

  let name = /^[^\.]*/.exec(file)[0]
  describe(name, () => {
    for (let {name, config, test, expected} of getCases(
      fs.readFileSync(path.resolve(caseDir, file), 'utf8')
    )) {
      let parser = parsers[config.parser]
      it(name, () => assert.equal(expected, print(test, parser)))
    }
  })
}
