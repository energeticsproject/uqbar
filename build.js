const {dependencies} = require('./package.json')
const esbuild = require('esbuild')
const path = require('path')
const fs = require('fs')

const build = async () => {
  if (fs.existsSync('build')) {
    fs.rmSync('build', {recursive: true})
  }

  fs.mkdirSync('build')

  let node = {
    entryPoints: ['src/index.ts'],
    platform: 'node',
    bundle: true,
    sourcemap: true,
    external: Object.keys(dependencies),
    target: ['esnext'],
    plugins: [
      {
        name: 'grammar',
        setup(build) {
          build.onResolve({filter: /\.grammar$/}, (args) => {
            return {
              path: path.resolve(path.dirname(args.importer), args.path),
              namespace: 'grammar-ns',
            }
          })
          build.onLoad({filter: /./, namespace: 'grammar-ns'}, (args) => {
            return {
              contents: fs.readFileSync(args.path),
              loader: 'text',
            }
          })
        },
      },
    ],
    outfile: 'build/index.node.js',
    format: 'cjs',
  }
  await esbuild.build(node).catch(() => process.exit(1))

  let browser = {
    ...node,
    platform: 'browser',
    plugins: [
      ...node.plugins,
      {
        name: 'browser',
        setup(build) {
          build.onResolve({filter: /\.node(\.\w+)?$/}, (args) => {
            return {
              path: path.resolve(
                path.dirname(args.importer),
                args.path.replace('node', 'browser.ts')
              ),
              namespace: 'browser-ns',
            }
          })
          build.onLoad({filter: /./, namespace: 'browser-ns'}, (args) => {
            return {
              contents: fs.readFileSync(args.path),
              loader: 'ts',
            }
          })
        },
      },
    ],
    outfile: 'build/index.browser.js',
    format: 'esm',
  }
  await esbuild.build(browser).catch((e) => process.exit(1))

  if (fs.existsSync('dev-cm/build')) {
    fs.rmSync('dev-cm/build', {recursive: true})
  }

  fs.mkdirSync('dev-cm/build')

  fs.copyFileSync('dev-cm/src/index.html', 'dev-cm/build/index.html')

  await esbuild
    .build({
      format: 'iife',
      entryPoints: ['dev-cm/src/index.tsx'],
      bundle: true,
      outfile: 'dev-cm/build/index.js',
    })
    .catch((e) => process.exit(1))
}

build()
