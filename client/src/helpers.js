import * as r from 'ramda'

export function bem(className, modifiers) {
  return (className + ' ' + r.pipe(
    r.toPairs,
    r.filter(r.last),
    r.map(([element]) => `${className}--${element}`),
    r.join(' ')
  )(modifiers)).trim()
}
