import * as r from 'ramda'
import { parse, parseAllDocuments } from 'yaml'
import { useState, useEffect } from 'react'
import { Link, Route, Switch, useLocation } from 'wouter'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import levenshtein from 'js-levenshtein'

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { dark } from 'react-syntax-highlighter/dist/esm/styles/prism'

import './App.css'

import SearchDropdown from './SearchDropdown.jsx'


const REPO = 'https://raw.githubusercontent.com/ArseAssassin/pkdocs/main/docs'

function isUrlAbsolute(url) {
  let idx = url.indexOf(':')
  return idx < 10 && idx != -1
}

function useGet(url) {
  let [request, setRequest] = useState({
    status: 0,
    ok: false,
    loading: true,
    body: null
  })


  useEffect(
    () => {
      fetch(url)
      .then((res) => {
        setRequest({ ...request, status: res.status, ok: res.ok })
        return res.text()
      }).then((it) => {
        setRequest({ ...request, body: it })
      })
    },
    [url]
  )

  return request
}


function useDocs(slug) {
  let docs = useGet(`${REPO}/${slug}.pkd`)
  let [parsed, setParsed] = useState([])

  useEffect(() => {
    if (docs.body) {
      let doc = parse(r.last(docs.body.split('\n---\n')))
      let urlTable = r.fromPairs(doc.map((it, idx) => [it.id, idx]))
      setParsed([doc, urlTable])
    }
  }, [docs.body])

  return parsed
}

function FrontPage() {
  let index = useGet(`${REPO}/index.yml`)
  let docs = parse(index.body || '[]')

  return <div>
    <SearchDropdown
      placeholder='🔎  Search for languages/frameworks/libraries...'
      getQueriedItems={ (query) =>
        docs
        .filter((it) =>
          it.slug.toLowerCase().indexOf(query) > -1
        )
        .map((it) => ({ ...it, id: it.slug, url: `/${it.slug}` }))
      }
      renderListItem={ (it) =>
        <>
          <div>{ it.name }</div>
        </>
      }
      />

  </div>
}

function ListSymbols({ doc, docs, autofocus }) {
  let [query, setQuery] = useState('')
  let [selected, _setSelected] = useState(0)
  let [resultsList, setResultsList] = useState()

  let docsWithIds = docs.map((it, idx) =>
    ({ ...it, id: idx, url: `/${doc}/${idx}` })
  )

  let searchRanking = (it='') => {
    if (it === null) {
      it = ''
    }
    let idx = it.toLowerCase().indexOf(query)
    if (idx === -1) {
      return 1000
    } else {
      return idx
    }
  }

  return <div>
    <SearchDropdown
      ref={ (it) => {
        if (it && autofocus) {
          it.querySelector('input').focus()
        }
      } }
      getQueriedItems={ (query) => {
        return r.take(100, query === ''
          ? docsWithIds
          : r.sortWith(
            [(a, b) => searchRanking(a.name) - searchRanking(b.name),
              (a, b) =>
                levenshtein(a.name.toLowerCase(), query) -
                levenshtein(b.name.toLowerCase(), query),
             (a, b) => searchRanking(a.summary) - searchRanking(b.summary)],
            docsWithIds.filter(
              (it) =>
                it.name.toLowerCase().indexOf(query) !== -1 ||
                (it.summary || '').toLowerCase().indexOf(query) !== -1
            )
          )
        )

      }}
      renderListItem={ (it) => <>
        <div className="doc-search__result-name">
          { it.name }
        </div>
        <div className="doc-search__result-summary">
          { it.summary }
        </div>
      </>}
      placeholder='🔎  Search for docs...'/>
  </div>
}

function DocPage({ doc, symbolId }) {
  let [docs, urlTable] = useDocs(doc)

  if (!docs) {
    return <div />
  }

  let symbolSearch = <ListSymbols autofocus={ symbolId === undefined } doc={ doc } docs={ docs } />

  if (!symbolId) {
    return <div>
      {symbolSearch}
    </div>
  } else {
    let symbol = docs[parseInt(symbolId)]

    return <div>
      { symbolSearch }
      <div className="doc-symbol">
        <h1>{symbol.name}</h1>
        <div className="doc-symbol__body">
          <Markdown
            components={{
              a(props) {
                if (isUrlAbsolute(props.href || '')) {
                  return <a {...props} />
                } else if (urlTable[props.href] !== undefined) {
                  return <Link {...props} href={ `/${doc}/${urlTable[props.href]}` } />
                } else {
                  return props.children
                }
              },

              code({ children, className, node, ...rest }) {
                let match = /language-(\w+)/.exec(className || '')
                return (match)
                  ? <SyntaxHighlighter
                      {...rest}
                      className='doc-symbol__syntax-highlighter'
                      customStyle={{ backgroundColor: 'transparent' }}
                      PreTag="div"
                      data-language={ match }
                      children={ String(children).replace(/\n$/, '') }
                      language={ match[1] }
                    />
                  : <code {...rest} className={ className } data-language={ match }>
                      {children}
                    </code>
              }
            }}
            remarkPlugins={[remarkGfm]}>{symbol.description}</Markdown>
        </div>
      </div>
    </div>
  }
}

function App() {
  return (
    <Switch>
      <Route path='/' component={ FrontPage } />
      <Route path='/:doc/:symbol?'>
        {(params) => <DocPage doc={ params.doc } symbolId={ params.symbol } />}
      </Route>
    </Switch>
  )
}

export default App
