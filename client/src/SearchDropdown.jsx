import './SearchDropdown.css'
import * as r from 'ramda'
import { forwardRef, useState, useEffect } from 'react'
import { Link, useLocation } from 'wouter'
import { bem } from './helpers.js'

let SearchDropdown = forwardRef(({ placeholderValue, placeholder, getQueriedItems, renderListItem, onFocus }, ref ) => {
  let [_, navigate] = useLocation()
  let [query, setQuery] = useState('')
  let [resultsList, setResultsList] = useState()
  let [selected, _setSelected] = useState(0)
  let [isFocused, setIsFocused] = useState(0)

  let results = getQueriedItems(query)

  let setSelected = (idx, scrollToItem) => {
    _setSelected(idx)

    if (scrollToItem && resultsList) {
      resultsList.children[idx].scrollIntoView({ block: 'nearest' })
    }
  }
  let addSelected = (delta) => {
    setSelected(Math.min(results.length-1, Math.max(0, selected + delta)), true)
  }

  return (
    <form
      ref={ ref }
      className="search-dropdown"
      onFocus={ () => { setIsFocused(true) }}
      onBlur={ () => { setIsFocused(false) }}
      onSubmit={ (e) => {
        e.preventDefault()
        navigate(results[selected].url)
        document.activeElement.blur()
      }}>
        <input
          className='search-dropdown__query'
          onFocus={ onFocus }
          placeholder={ placeholder }
          value={ isFocused ? query : placeholderValue || query }
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
