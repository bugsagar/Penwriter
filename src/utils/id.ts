let counter = 0

export function uid(prefix = 'id'): string {
  counter = (counter + 1) % 0xffff
  const n = Date.now().toString(36)
  const r = Math.random().toString(36).slice(2, 7)
  return `${prefix}_${n}${counter.toString(36)}${r}`
}
