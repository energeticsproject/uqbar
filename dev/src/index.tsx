import React, {useEffect, useRef, useState} from 'react'
import ReactDOM from 'react-dom'
import {
  setGithubAuth,
  languageRegistryDefault,
  LanguageEditor,
  SampleEditor,
  print,
  setEsbuildLoader,
  setBuildParserFileAsyncWorkerLoader,
} from '../../build/index.js'

setGithubAuth('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')
setEsbuildLoader(async () => {
  let esbuild = await import('esbuild-wasm')
  let wasmURL = 'https://unpkg.com/esbuild-wasm@0.13.14/esbuild.wasm'
  await esbuild.initialize({wasmURL})
  return esbuild
})
setBuildParserFileAsyncWorkerLoader(
  async () => (await import('../../build/buildParserFileAsyncWorker')).default
)

const PseudoList = <T extends any>(props: {
  values: T[]
  children: (value: T) => any
  maxLengthCollapsed?: number
}) => {
  let {values, children, maxLengthCollapsed = 999} = props
  let [expanded, setExpanded] = useState(false)
  useEffect(() => setExpanded(false), [values])
  if (!values?.length) return null
  let showMoreButton = false
  if (!expanded && values.length > maxLengthCollapsed) {
    values = values.slice(0, maxLengthCollapsed - 1)
    showMoreButton = true
  }

  return (
    <ul
      style={{
        padding: 0,
        margin: '16px -5px',
        listStyle: 'none',
        display: 'flex',
        flexWrap: 'wrap',
      }}
    >
      {values.map((value, i) => (
        <li key={i} style={{display: 'block', padding: '3px 5px'}}>
          {children(value)}
        </li>
      ))}
      {showMoreButton && (
        <li style={{display: 'block', padding: '3px 5px'}}>
          <button onClick={() => setExpanded(true)}>More</button>
        </li>
      )}
    </ul>
  )
}

const Sandbox = () => {
  const languageEditorViewContainer = useRef(null as HTMLDivElement)
  const sampleEditorViewContainer = useRef(null as HTMLDivElement)
  const [nonce, setNonce] = useState(0)
  const [languageEditor] = useState(new LanguageEditor(languageRegistryDefault))
  const [sampleEditor] = useState(new SampleEditor(languageRegistryDefault))

  useEffect(() => {
    languageEditor.mount(languageEditorViewContainer.current)
    languageEditor.addListener('all', () => setNonce(Math.random()))
    languageEditor.openLanguage('javascript')

    sampleEditor.mount(sampleEditorViewContainer.current)
    sampleEditor.addListener('all', () => setNonce(Math.random()))
    sampleEditor.openSample('javascript')

    languageEditor.addListener('build', async () => {
      let l = languageEditor.language
      sampleEditor.openSample(l.name)
    })

    return () => {
      languageEditor.destroy()
      sampleEditor.destroy()
    }
  }, [])

  return (
    <div>
      <style>{`
        .cm-editor {
          border: 1px solid silver;
        }

        .cm-gutter {
          user-select: none;
        }
      `}</style>
      <h1>@energetics/lr-utils</h1>
      <PseudoList values={languageRegistryDefault.languageOptions}>
        {(lo: any) => (
          <button
            onClick={() => languageEditor.openLanguage(lo.module.index)}
            disabled={
              lo.module.index ===
              (languageEditor.loading.language ?? languageEditor.language?.name)
            }
          >
            {lo.label}
          </button>
        )}
      </PseudoList>
      <hr />
      <PseudoList values={languageEditor.language?.src}>
        {(f: any) => (
          <button
            onClick={() => languageEditor.openFile(f.path)}
            disabled={
              f.path ===
              (languageEditor.loading.file?.split?.(':')?.[1] ??
                languageEditor.file.path)
            }
          >
            {(() => {
              return (
                f.path.split('/').slice(-2).join('/').replace(/^\//, '') +
                (f.entry ? ' (entry)' : '')
              )
            })()}
          </button>
        )}
      </PseudoList>
      <div ref={languageEditorViewContainer}></div>
      <p>
        <button
          onClick={() => languageEditor.build()}
          disabled={
            !!(
              languageEditor.loading.language ||
              languageEditor.loading.file ||
              languageEditor.loading.build
            )
          }
        >
          Rebuild
        </button>
      </p>
      {(languageEditor.language?.errors?.parser ||
        languageEditor.language?.errors?.support ||
        languageEditor.language?.errors?.index) && (
        <pre>
          {languageEditor.language.errors.parser?.message ??
            languageEditor.language.errors.parser ??
            languageEditor.language.errors.support?.message ??
            languageEditor.language.errors.support ??
            languageEditor.language.errors.index?.message ??
            languageEditor.language.errors.index}
        </pre>
      )}
      <hr />
      <PseudoList values={sampleEditor.collection?.src} maxLengthCollapsed={10}>
        {(f: any) => (
          <button
            onClick={() => sampleEditor.openFile(f.path)}
            disabled={
              f.path ===
              (sampleEditor.loading.file?.split?.(':')?.[1] ??
                sampleEditor.file.path)
            }
          >
            {f.path.split('/').slice(-1)[0]}
          </button>
        )}
      </PseudoList>
      <div ref={sampleEditorViewContainer}></div>
      <p>
        <button onClick={() => setNonce(Math.random())}>Parse</button>
      </p>
      {!!(sampleEditor.editorView && sampleEditor.language?.parser) && (
        <pre>
          <code>
            {print(
              sampleEditor.editorView.state.sliceDoc(0),
              sampleEditor.language.parser
            )}
          </code>
        </pre>
      )}
    </div>
  )
}

ReactDOM.render(<Sandbox />, document.getElementById('root'))
