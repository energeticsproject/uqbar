/**
 * We build the lezer packages from source to expose some of the internals as public
 */

const fs = require('fs')
const path = require('path')
const shell = require('shelljs')

const lzPath = path.resolve(__dirname, 'node_modules/@lezer')

shell.cd(lzPath)

let tags = {
  lr: JSON.parse(shell.cat('./lr/package.json')).version,
  common: JSON.parse(shell.cat('./common/package.json')).version,
  generator: JSON.parse(shell.cat('./generator/package.json')).version,
}

let update = (...params) => {
  let f = params.pop()
  let p = path.resolve(...params.map((s) => s.toString()))
  fs.writeFileSync(p, f(fs.readFileSync(p, 'utf8')))
}

for (let lib in tags) {
  let tag = tags[lib]
  let repo = `https://github.com/lezer-parser/${lib}.git`
  let config = `-c advice.detachedHead=false`
  shell.rm('-rf', lib)
  shell.exec(`git ${config} clone --depth 1 --branch ${tag} ${repo}`)
  shell.cd(lib)
  shell.pwd()
  update(shell.pwd(), 'tsconfig.json', (v) => {
    return v.replace('"stripInternal": true', '"stripInternal": false')
  })
  switch (lib) {
    case 'lr': {
      update(shell.pwd(), 'src/index.ts', (v) => {
        return (
          'import * as constants from "./constants"\n' +
          'export {constants}\n' +
          v
        )
      })
      update(shell.pwd(), 'src/parse.ts', (v) => {
        return v.replace('private stackID', 'stackID')
      })
    }
  }
  shell.exec('npm install') // does build as well as install
  shell.rm('-rf', 'node_modules')
  shell.cd('..')
}

// InputStream.peekContext(...terms: number[]): Tree

// NestedParse.initial: Tree

// InputStream.acceptToken(token: number, endOffset⁠?: number = 0)
// InputStream.acceptToken(token: number, innerParse?: NestedParse)

// Stack.innerParse(NestedParse): NestedParse

// new ExternalTokenizer((input, stack) => {
//   let tree = input.peekContext(CallExpression, NewExpression)
//   if (!treeIsChemistry) return
//   innerParse = stack.innerParse({parser: javascript}) // adds .initial property to innerParse
//   input.acceptToken(Embed, innerParse)
// })
