import * as r from 'ramda'
import { parse, parseAllDocuments } from 'yaml'
import { useState, useEffect, isValidElement } from 'react'
import { Router, Link, Route, Switch, useLocation } from 'wouter'
import { useHashLocation } from 'wouter/use-hash-location'
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
  return url.indexOf('#') !== 0 && idx < 10 && idx != -1
}

function formatSignature(signatureParams) {
  return (
    (
      r.init(signatureParams)
      .map(formatSignatureParam)
      .join(', ')
    )
    + ' -> ' +
    formatSignatureParam(r.last(signatureParams))
  )
}

function formatSignatureParam(param) {
  return `${param.name || ''}${param.name && param.type ? ':' : ''}${param.type || ''}`
}

function highlightCode({ children, className, node, ...rest }) {
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

const DEFAULT_REQUEST = {
  status: undefined,
  ok: false,
  loading: true,
  body: null
}

function useGet(url) {
  let [request, setRequest] = useState(DEFAULT_REQUEST)

  useEffect(
    () => {
      setRequest(DEFAULT_REQUEST)

      fetch(url)
      .then((res) => {
        let updated = { ...request, status: res.status, ok: res.ok, loading: false }
        setRequest(updated)
        return res.text().then((it) => {
          setRequest({ ...updated, body: it })
        })
      })
    },
    [url]
  )

  return request
}


function useDocs(gen, slug) {
  let docs = gen !== 'github'
    ? useGet(`${REPO}/${gen}/${slug}`)
    : useGet('https://raw.githubusercontent.com/' + slug)

  let [parsed, setParsed] = useState([])

  useEffect(() => {
    if (docs.body) {
      let docParts = docs.body.split('\n---\n')
      let doc = parse(r.last(docParts))
      let urlTable = r.fromPairs(doc.map((it, idx) => [it.id, idx]))
      setParsed([parse(docParts[0]), doc, urlTable])
    }
  }, [docs.body])

  useEffect(() => {
    setParsed([])
  }, [slug])

  return [parsed, docs]
}

function DataTable({ data }) {
  return <table className="data-table">
    <tbody>
      {r.toPairs(data).map(([key, value]) =>
        <tr key={ key }>
          <th>{ key }</th>
          <td>{
            typeof value === 'object' && !isValidElement(value)
              ? <DataTable data={ value } />
              : value
          }</td>
        </tr>
      )}
    </tbody>
  </table>
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
        placeholder='🔎  Search for languages / libraries...'
        getQueriedItems={ (query) =>
          docs
          .filter((it) =>
            it.path.toLowerCase().indexOf(query) > -1
          )
          .map((it) => ({ ...it, id: it.path, url: `/${it.path}` }))
          .concat([{
            id: '/something-missing',
            url: '/something-missing'
          }])
        }
        renderListItem={ (it) =>
          it.path
          ? <div className='doctable-search__result'>
            <div className='doctable-search__result-slug'>
              { it.path }
            </div>
            <div className='doctable-search__result-name'>
              { it.name }
            </div>

            <div className='doctable-search__result-version'>
              { it.version }
            </div>
          </div>
          : <div className="doctable-search__result">
            <div>
              Something missing?
            </div>
            <div className='doctable-search__result-version'>
              Finding more docs
            </div>
          </div>
        }
        />
    </div>
  </div>
}

function ListSymbols({ gen, doc, docs, autofocus }) {
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
    ({ ...it, id: idx, url: `/${gen}/${encodeURIComponent(doc)}/${idx}` })
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
        <div className="doc-search__result-kind">
          { it.kind }
        </div>
        <div className="doc-search__result-name">
          <code className='doc-search__result-ns'>{ it.ns }</code> { it.name }
        </div>
        <div className="doc-search__result-summary">
          { it.summary }
        </div>
        { it.signatures && <code className="doc-search__result-signatures">
          { formatSignature(it.signatures[0]) }
        </code> }
      </>}
      placeholder='🔎  Search for docs... (Type /)'/>
  </div>
}

function CopyrightNotice({ headers }) {
  return <div className="doc-copyright">
    { headers.name } documentation {'\n'}
    { headers.copyright || `license: ${headers.license}` }
  </div>
}

function Loader() {
  return <div className="loader__wrapper">
    <div className="loader__notice">
      Parsing docs. <br/>This can take some time...
    </div>
    <div className="loader"></div>
  </div>
}

function preformatSymbol(it) {
  return r.pipe(
    r.omit(['description', 'ns', 'signatures']),
    it.signatures
      ? r.mergeLeft({
        signatures: it.signatures.map(formatSignature).map((it, idx) =>
          <code key={ idx }>{ it }</code>
        )
      })
      : r.identity,
    it.ns
      ? r.mergeRight({
        namespace: it.ns
      })
      : r.identity
  )(it)
}

function DocPage({ gen, doc, symbolId }) {
  let [[headers, docs, urlTable], request] = useDocs(gen, doc)

  useEffect(() => {
    if (headers && headers.name) {
      document.title = `pkDocs - ${doc}`
    }
  }, [headers && headers.name])

  if (request.loading || !docs) {
    return <Loader />
  }

  if (request.status === 404) {
    return <NotFound />
  }

  let symbolSearch = <ListSymbols autofocus={ symbolId === undefined } gen={ gen } doc={ doc } docs={ docs } />

  let markdownComponents = {
    a(props) {
      if (isUrlAbsolute(props.href || '')) {
        return <a {...props} />
      } else if (props.href.indexOf('#') === 0) {
        return props.children
      } else if (urlTable[decodeURIComponent(props.href)] !== undefined) {
        return <Link {...props} href={ `/${gen}/${encodeURIComponent(doc)}/${urlTable[decodeURIComponent(props.href)]}` } />
      } else {
        return props.children
      }
    },

    code: highlightCode
  }

  if (!symbolId) {
    return <div>
      {symbolSearch}

      { headers.description &&
        <div className="doc-frontpage">
          <div className="doc-symbol">
            <h1>{ headers.name } { headers.version }</h1>
            <div className="doc-symbol__body">
              <Markdown
                components={ markdownComponents }
                remarkPlugins={[remarkGfm]}>
                  { headers.description }
              </Markdown>
            </div>
          </div>
        </div>
      }


      <CopyrightNotice headers={ headers } />
    </div>
  } else {
    let symbol = docs[parseInt(symbolId)]

    return <div>
      { symbolSearch }
      <div className="doc-symbol">
        <h1>{symbol.name}</h1>
        <DataTable data={ preformatSymbol(symbol) } />

        { headers.text_format === 'markdown'
          ? <div className="doc-symbol__body">
            <Markdown
              components={ markdownComponents }
              remarkPlugins={[remarkGfm]}>
                {symbol.description}
            </Markdown>
          </div>
          : <pre>{ symbol.description }</pre> }
        <CopyrightNotice headers={ headers } />
      </div>
    </div>
  }
}

function SomethingMissing() {
  return <div className="something-missing"><div className="doc-symbol">
    <div className="doc-symbol__body">
      <Markdown>{`
# Something missing?

The documentation on pkDocs is selected from the [pikadoc central repository](https://github.com/ArseAssassin/pkdocs/tree/main/docs), a library containing reference documentation for 150+ modern languages/frameworks/libraries. While we'd love to have documentation for every tech stack on Earth, right now we're not there. If you feel that we're missing something that should be here, here are a few options:

## Generating pkd-files

The fastest way to get access to the docs you need is by using the [PikaDoc CLI](https://github.com/ArseAssassin/pikadoc). In addition to the docs available in the central repository, this tool can generate documentation from many popular sources such as npm, pypi, GitHub repos, and more. Getting docs from a featured source is as simple as typing:

> \`doc src:{source} use {package}\`

In addition to the basic features that this browser client supports, the CLI supports features advanced queries, looking up symbol source code and more.

## Featuring docs on the central repository

If you feel there's something that we should add to the repository, you can raise an issue on our [issue tracker](https://github.com/ArseAssassin/pkdocs/issues). The best way to have your project featured is to add a \`DOCS.pkd\` file following the \`.pkd\` YAML file format to the root of your repo. For more information on the file format, see the documentation in the pikadoc repo.
      `}</Markdown>
    </div>
  </div></div>
}

function FrontPage() {
  return <div></div>
}

function NotFound() {
  return <div className="error-page">
    <h1>404</h1>
    <p>Looks like there's nothing here</p>
  </div>
}

function App() {
  let [ pathname ] = useHashLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div>
      <nav className='site-navi'>
        <a href='https://github.com/ArseAssassin/pikadoc'>pkDocs on GitHub</a>
      </nav>
      <Router hook={ useHashLocation }>
        <Switch>
          <Route path='/something-missing' component={ SomethingMissing } />
          <Route path='/' component={ DoctableSearch } />
          <Route path='/:gen/:doc/:symbol?'>
            {(params) => <>
              <DoctableSearch
                key='search-bar'
                selectedDoc={ params.gen + '/' + decodeURIComponent(params.doc) } />
              <DocPage
                gen={ params.gen }
                doc={ decodeURIComponent(params.doc) }
                symbolId={ params.symbol } />
            </>}
          </Route>
          <Route><NotFound /></Route>
        </Switch>
      </Router>
    </div>
  )
}

export default App
