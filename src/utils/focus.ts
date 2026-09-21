export function setCaret(div: HTMLElement, pos: 'start' | 'end' | number): void {
  const sel = window.getSelection()
  if (!sel) return
  const range = document.createRange()
  range.selectNodeContents(div)
  if (pos === 'start') {
    range.collapse(true)
  } else if (pos === 'end') {
    range.collapse(false)
  } else {
    const node = div.firstChild ?? div
    const offset = Math.min(pos, (div.textContent ?? '').length)
    range.setStart(node, offset)
    range.collapse(true)
  }
  sel.removeAllRanges()
  sel.addRange(range)
  div.focus({ preventScroll: false })
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function highlightHtml(text: string, query: string): string {
  const q = query.trim()
  if (!q) return escapeHtml(text)
  const lower = text.toLowerCase()
  const ql = q.toLowerCase()
  let result = ''
  let cursor = 0
  let idx = lower.indexOf(ql, cursor)
  while (idx !== -1) {
    result += escapeHtml(text.slice(cursor, idx))
    result += `<mark class="sp-highlight">${escapeHtml(text.slice(idx, idx + ql.length))}</mark>`
    cursor = idx + ql.length
    idx = lower.indexOf(ql, cursor)
  }
  result += escapeHtml(text.slice(cursor))
  return result
}
