import { chromium } from 'playwright'

const url = process.env.APP_URL || 'http://localhost:4173'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

await page.goto(url, { waitUntil: 'networkidle' })
await page.click('text=Try sample')
await page.waitForSelector('[data-elid]', { timeout: 8000 })
await page.waitForTimeout(400)

const report = await page.evaluate(() => {
  const paper = document.querySelector('.paper-sheen')?.parentElement
  const sheet = document.querySelector('.paper-sheen')
  const blocks = Array.from(document.querySelectorAll('[data-elid]'))
  const heading = blocks.find((b) => (b.textContent || '').startsWith('EXT. TRAIN'))
  const character = blocks.find((b) => (b.textContent || '').startsWith('MAYA'))
  const dialogue = blocks.find((b) => (b.textContent || '').startsWith('Where is everyone?'))

  const cs = (el) => el ? getComputedStyle(el) : null
  const rect = (el) => el ? el.getBoundingClientRect() : null

  const paperRect = rect(sheet)
  const headingRect = rect(heading)
  const charRect = rect(character)
  const diaRect = rect(dialogue)

  return {
    paperWidth: paperRect && Math.round(paperRect.width),
    paperMinHeight: sheet ? Math.round(sheet.getBoundingClientRect().height) : null,
    headingFont: cs(heading)?.fontFamily,
    headingFontSize: cs(heading)?.fontSize,
    headingBold: cs(heading)?.fontWeight,
    headingLeftOffset: headingRect ? Math.round(headingRect.left - paperRect.left) : null,
    characterLeftOffset: charRect ? Math.round(charRect.left - paperRect.left) : null,
    dialogueLeftOffset: diaRect ? Math.round(diaRect.left - paperRect.left) : null,
    dialogueWidth: diaRect ? Math.round(diaRect.width) : null,
    actionLineHeight: cs(heading)?.lineHeight,
    pageBreaks: document.querySelectorAll('.sp-block').length,
  }
})

console.log(JSON.stringify(report, null, 2))
await browser.close()
