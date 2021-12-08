import React, {useEffect, useRef, useState} from 'react'
import ReactDOM from 'react-dom'
import {basicSetup} from '@codemirror/basic-setup'
import {EditorState} from '@codemirror/state'
import {EditorView} from '@codemirror/view'
import {LanguageSupport, LRLanguage} from '@codemirror/language'
import {chemistry, javascript} from '../../build/index.browser'

let doc =
  'basicFunctionCall(arg) +\nchemistry.reaction(H2O -> H2 + O ~ tempreature ** 0.5)'

class Editor {
  view: EditorView
  constructor(
    readonly container: HTMLElement // readonly support: LanguageSupport
  ) {
    this.view = new EditorView({
      state: EditorState.create({
        doc,
        extensions: [
          basicSetup,
          LRLanguage.define({
            parser: javascript,
          }),
        ],
      }),
      parent: container,
    })
  }
}

const Sandbox = () => {
  const editorViewContainer = useRef(null as HTMLDivElement)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    const editor = new Editor(editorViewContainer.current)

    return () => editor.view.destroy()
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
      <div ref={editorViewContainer}></div>
    </div>
  )
}

ReactDOM.render(<Sandbox />, document.getElementById('root'))
