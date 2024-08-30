import './SearchDropdown.css'
import * as r from 'ramda'
import { forwardRef, useState, useEffect } from 'react'
import { Link, useLocation } from 'wouter'

function bem(className, modifiers) {
  return (className + ' ' + r.pipe(
    r.toPairs,
    r.filter(r.last),
    r.map(([element]) => `${className}--${element}`),
    r.join(' ')
  )(modifiers)).trim()
}

let SearchDropdown = forwardRef(({ placeholder, getQueriedItems, renderListItem }, ref ) => {
  let [_, navigate] = useLocation()
  let [query, setQuery] = useState('')
  let [resultsList, setResultsList] = useState()
  let [selected, _setSelected] = useState(0)

  let results = getQueriedItems(query)

  let setSelected = (idx, scrollToItem) => {
    _setSelected(idx)

    if (scrollToItem) {
      resultsList.children[idx].scrollIntoView({ block: 'nearest' })
    }
  }
  let addSelected = (delta) => {
    setSelected(Math.min(results.length, Math.max(0, selected + delta)), true)
  }

  return (
    <form ref={ ref } className="search-dropdown" onSubmit={ (e) => {
        e.preventDefault()
        navigate(results[selected].url)
        document.activeElement.blur()
      }}>
        <input
          className='search-dropdown__query'
          placeholder={ placeholder }
          value={ query }
          onKeyDown={ (e) => {
            let idx =
              e.key === 'ArrowUp' && addSelected(-1) ||
              e.key === 'ArrowDown' && addSelected(1) ||
              e.key === 'Home' && setSelected(0, true) ||
              e.key === 'End' && setSelected(results.length-1, true)
          }}
          onChange={ (e) => {
            setQuery(e.target.value.toLowerCase())
            setSelected(0, true)
          }} />

        <div className="search-dropdown__results" ref={ setResultsList }>
          { results.map((it, idx) =>
            <Link
              key={ it.id }
              onMouseMove={ () => setSelected(idx, false) }
              onClick={ (e) => document.activeElement.blur() }
              className={
                bem('search-dropdown__result', {
                  selected: selected === idx
                })}
              href={ it.url }>
              { renderListItem(it) }
            </Link>
          ) }
        </div>
      </form>
  )
})

export default SearchDropdown
