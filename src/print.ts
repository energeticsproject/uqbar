import {Parser, TreeCursor} from '@lezer/common'

export interface PrintTree {
  name: string
  from: number
  to: number
  children: PrintTree[]
}

export const parse = (code: string, parser: Parser): PrintTree => {
  let cursor = parser.parse(code).cursor()
  return niceTree(cursor)
}

export const niceTree = (cursor: TreeCursor): PrintTree => {
  let tree: PrintTree = {
    name: cursor.name,
    from: cursor.from,
    to: cursor.to,
    children: [],
  }

  let child = cursor.firstChild()
  if (!child) return tree

  do {
    let copy = cursor.node.cursor
    tree.children.push(niceTree(copy))
  } while (cursor.nextSibling())

  return tree
}

export const printOnly = (code: string, tree: PrintTree): string => {
  let visit = (node: PrintTree, indent = '\n'): string => {
    let printed = ''
    let show = /^([A-Z]|⚠)/.test(node.name) || node.children.length
    if (show) printed += `${node.name}(`
    if (!node.children.length) {
      let snip = code.slice(node.from, node.to)
      snip = snip.replace(/\\n/g, `\\n`).replace(/\\t/g, `\\t`)
      snip = snip.replace(/"/g, `\\"`)
      printed += `"${snip}"`
      if (show) printed += ')'
    } else {
      let i2 = indent + '  '
      printed += i2 + node.children.map((c) => visit(c, i2)).join(i2)
      if (show) printed += indent + ')'
    }
    return printed
  }
  return visit(tree)
}

export const print = (code: string, parser: Parser) => {
  return printOnly(code, parse(code, parser))
}
