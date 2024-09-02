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

import { bem } from './helpers.js'

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
      let docParts = docs.body.split('\n---\n')
      let doc = parse(r.last(docParts))
      let urlTable = r.fromPairs(doc.map((it, idx) => [it.id, idx]))
      setParsed([parse(docParts[0]), doc, urlTable])
    }
  }, [docs.body])

  return parsed
}

function DoctableSearch({ selectedDoc }) {
  let [folded, setFolded] = useState(false)
  let index = useGet(`${REPO}/index.yml`)
  let docs = parse(index.body || '[]')

  return <div className={ bem("doctable-search", {
     folded: folded || Boolean(selectedDoc)
   }) }>
    <div className="doctable-search__body">
      <header>
        <h1>pkDocs</h1>
        <h4>Quick docs for your tech stack</h4>
      </header>
      <SearchDropdown
        onFocus={ () => setFolded(true) }
        placeholderValue= { selectedDoc }
        placeholder='🔎  Search for languages/frameworks/libraries...'
        getQueriedItems={ (query) =>
          docs
          .filter((it) =>
            it.slug.toLowerCase().indexOf(query) > -1
          )
          .map((it) => ({ ...it, id: it.slug, url: `/pkdocs/${it.slug}` }))
        }
        renderListItem={ (it) =>
          <div className='doctable-search__result'>
            <div className='doctable-search__result-slug'>
              { it.slug }
            </div>
            <div className='doctable-search__result-name'>
              { it.name }
            </div>

            <div className='doctable-search__result-version'>
              { it.version }
            </div>
          </div>
        }
        />
    </div>
  </div>
}

function ListSymbols({ doc, docs, autofocus }) {
  let [query, setQuery] = useState('')
  let [selected, _setSelected] = useState(0)
  let [resultsList, setResultsList] = useState()
  let [searchInput, setSearchInput] = useState()

  useEffect(() => {
    if (searchInput) {
      let focus = (e) => {
        if (e.code === 'Digit7' && e.shiftKey) {
          e.preventDefault()
          let input = searchInput.querySelector('input')
          input.focus()
          input.select()
        }
      }
      document.body.addEventListener('keydown', focus)

      return () => {
        document.body.removeEventListener('keydown', focus)
      }
    }
  }, [searchInput])

  let docsWithIds = docs.map((it, idx) =>
    ({ ...it, id: idx, url: `/pkdocs/${doc}/${idx}` })
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

  return <div className='doc-search'>
    <SearchDropdown
      ref={ setSearchInput }

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
      placeholder='🔎  Search for docs... (Type /)'/>
  </div>
}

function CopyrightNotice({ headers }) {
  return <div className="doc-copyright">
    { headers.name } documentation {'\n'}
    { headers.copyright }
  </div>
}

function Loader() {
  return <div className="loader__wrapper">
    <div className="loader"></div>
  </div>
}

function DocPage({ doc, symbolId }) {
  let [headers, docs, urlTable] = useDocs(doc)

  useEffect(() => {
    document.title = `pkDocs - ${doc}`
  }, [doc])

  if (!docs) {
    return <Loader />
  }

  let symbolSearch = <ListSymbols autofocus={ symbolId === undefined } doc={ doc } docs={ docs } />

  if (!symbolId) {
    return <div>
      {symbolSearch}

      <CopyrightNotice headers={ headers } />
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
                  return <Link {...props} href={ `/pkdocs/${doc}/${urlTable[props.href]}` } />
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

        <CopyrightNotice headers={ headers } />
      </div>
    </div>
  }
}

function FrontPage() {
  return <div>

  </div>
}

function App() {
  let [ pathname ] = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div>
      <Route path='/pkdocs/:doc?/:symbol?'>
        {(params) => <DoctableSearch selectedDoc={ params.doc } />}
      </Route>
      <Switch>
        <Route path='/pkdocs/' component={ FrontPage } />
        <Route path='/pkdocs/:doc/:symbol?'>
          {(params) => <DocPage doc={ params.doc } symbolId={ params.symbol } />}
        </Route>
      </Switch>
    </div>
  )
}

export default App
