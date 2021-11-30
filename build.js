const {dependencies} = require('./package.json')
const esbuild = require('esbuild')
const path = require('path')
const fs = require('fs')

const build = async () => {
  if (fs.existsSync('build')) {
    fs.rmSync('build', {recursive: true})
  }

  fs.mkdirSync('build')

  await esbuild
    .build({
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
      outfile: 'build/index.js',
      format: 'cjs',
    })
    .catch(() => process.exit(1))
}

build()
