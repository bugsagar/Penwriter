/** A file that can't be imported, with a message the writer can act on. */
export class ImportError extends Error {}

export const IMPORT_EXTS = ['.docx', '.pdf', '.txt', '.fountain']
export const IMPORT_MIME: Record<string, string[]> = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/pdf': ['.pdf'],
  'text/plain': ['.txt', '.fountain'],
}


export function isImportable(name: string): boolean {
  const n = name.toLowerCase()
  return IMPORT_EXTS.some((e) => n.endsWith(e)) || n.endsWith('.doc')
}

