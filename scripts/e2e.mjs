import { chromium } from 'playwright'
import { PDFDocument } from 'pdf-lib'
import { readFileSync } from 'fs'

const results = []
function check(name, ok, extra = '') {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`)
}

const url = process.env.APP_URL || 'http://localhost:4173'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})

await page.goto(url, { waitUntil: 'networkidle' })

// ---------- Homepage ----------
await page.waitForSelector('text=Write scripts', { timeout: 10000 })
check('Homepage loads', await page.isVisible('text=Write scripts'))

// ---------- Studio (clean dashboard) ----------
await page.click('text=Start writing for free')
await page.waitForSelector('text=New Screenplay', { timeout: 8000 })
check('Studio opens from homepage', await page.isVisible('text=Projects'))

// ---------- New Screenplay dialog ----------
await page.click('text=New Screenplay')
await page.waitForSelector('text=Create Screenplay')
await page.fill('input[placeholder="My Movie"]', 'The Lighthouse')
await page.fill('input[placeholder="Your name"]', 'Jane Writer')
await page.click('text=Create Screenplay')
await page.waitForSelector('[data-elid]', { timeout: 8000 })
check('Editor opens after creating screenplay', true)

const blocks = page.locator('[data-elid]')
const cls = (i) => blocks.nth(i).getAttribute('class')

// ---------- Automatic formatting: scene heading ----------
await blocks.nth(0).click()
await blocks.nth(0).type('INT. HOUSE - NIGHT', { delay: 1 })
await page.waitForTimeout(200)
check('INT. detected as scene heading', (await cls(0)).includes('sp-scene-heading'))

// ---------- Enter (x2) -> Action ----------
// Single Enter is a soft line break inside the same box;
// a second Enter on the trailing empty line exits to a new block.
await blocks.nth(0).press('Enter')
await page.waitForTimeout(200)
await blocks.nth(0).press('Enter')
await page.waitForTimeout(200)
check('Enter after heading creates Action', (await cls(1)).includes('sp-action'))

// ---------- Action -> all-caps -> Enter -> Character + Dialogue ----------
await blocks.nth(1).click()
await blocks.nth(1).type('JOHN', { delay: 1 })
await page.waitForTimeout(200)
await blocks.nth(1).press('Enter')
await page.waitForTimeout(200)
await blocks.nth(1).press('Enter')
await page.waitForTimeout(200)
check('Uppercase action upgrades to Character', (await cls(1)).includes('sp-character'))
check('Enter after character creates Dialogue', (await cls(2)).includes('sp-dialogue'))

// ---------- Type dialogue ----------
await blocks.nth(2).click()
await blocks.nth(2).type('Where is everyone?', { delay: 1 })
await page.waitForTimeout(200)
check('Dialogue text entered', (await blocks.nth(2).textContent()).includes('Where is everyone?'))

// ---------- Alt+Tab opens element menu -> parenthetical -> transition ----------
await blocks.nth(2).click()
await blocks.nth(2).press('Alt+Tab')
await page.waitForTimeout(150)
check('Tab opens element type menu', await page.isVisible('[data-type-menu]'))
await blocks.nth(2).press('ArrowDown')
await blocks.nth(2).press('Enter')
await page.waitForTimeout(150)
check('Menu: dialogue -> parenthetical', (await cls(2)).includes('sp-parenthetical'))
check('Menu closes after select', !(await page.isVisible('[data-type-menu]')))
await blocks.nth(2).press('Alt+Tab')
await page.waitForTimeout(150)
await blocks.nth(2).press('ArrowDown')
await blocks.nth(2).press('Enter')
await page.waitForTimeout(150)
check('Menu: parenthetical -> transition', (await cls(2)).includes('sp-transition'))

// ---------- New scene: double Enter on transition -> action, type INT ----------
await blocks.nth(2).press('Enter')
await page.waitForTimeout(200)
await blocks.nth(2).press('Enter')
await page.waitForTimeout(200)
check('Enter after transition creates Action', (await cls(3)).includes('sp-action'))
await blocks.nth(3).click()
await blocks.nth(3).type('EXT. STREET - DAY', { delay: 1 })
await page.waitForTimeout(200)
check('Second scene heading detected', (await cls(3)).includes('sp-scene-heading'))

// ---------- Undo / redo ----------
await page.keyboard.press('ControlOrMeta+z')
await page.waitForTimeout(250)
check('Undo reverts last edit', !(await blocks.nth(3).textContent()).includes('DAY'))
await page.keyboard.press('ControlOrMeta+Shift+z')
await page.waitForTimeout(250)
check('Redo restores edit', (await blocks.nth(3).textContent()).includes('DAY'))

// ---------- Pages panel ----------
await page.waitForTimeout(200)
const asideText = await page.locator('aside').first().textContent()
check('Pages panel lists pages', asideText.includes('Page 1') && asideText.includes('Page 2'))
check('Pages panel previews headings', asideText.includes('INT. HOUSE - NIGHT') && asideText.includes('EXT. STREET - DAY'))
await page.click('aside >> text=Page 2')
await page.waitForTimeout(500)
const jumped = await blocks.nth(3).evaluate((el) => {
  const r = el.getBoundingClientRect()
  return r.top >= 0 && r.bottom <= window.innerHeight
})
check('Clicking Page 2 jumps to it', jumped)

// ---------- Footer word/page count ----------
const footerText = await page.locator('footer').textContent()
check('Footer shows words + pages', footerText.includes('words') && footerText.includes('pages'), footerText.trim())

// ---------- Search + highlight ----------
await page.keyboard.press('ControlOrMeta+f')
await page.waitForSelector('input[placeholder="Search screenplay…"]')
await page.fill('input[placeholder="Search screenplay…"]', 'STREET')
await page.waitForTimeout(300)
const marks = await page.locator('mark.sp-highlight').count()
check('Search highlights matches', marks >= 1, `found ${marks} marks`)

// ---------- Replace all ----------
await page.fill('input[placeholder="Replace with…"]', 'ROAD')
await page.click('text=Replace all')
await page.waitForTimeout(300)
const paperText = await page.locator('.sp-block').allTextContents()
check('Replace all applied', paperText.some((t) => t.includes('ROAD')))
check('Search closed after replace', !(await page.isVisible('input[placeholder="Search screenplay…"]')))

// ---------- Writing mode ----------
await page.keyboard.press('ControlOrMeta+Shift+f')
await page.waitForTimeout(300)
check('Writing mode hides sidebars', !(await page.isVisible('aside')))
await page.keyboard.press('ControlOrMeta+Shift+f')
await page.waitForTimeout(300)
check('Writing mode exit restores sidebars', await page.isVisible('aside'))

// ---------- Autosave ----------
await page.locator('[data-elid]').first().click()
await page.keyboard.type(' X', { delay: 1 })
await page.waitForTimeout(1600)
const headerText = await page.locator('header').textContent()
check('Autosave reaches Saved', headerText.includes('Saved'), headerText.trim())

// ---------- Reload persistence ----------
const titleBefore = await page.locator('header input').inputValue()
await page.reload({ waitUntil: 'networkidle' })
await page.waitForSelector('[data-elid]', { timeout: 8000 })
const titleAfter = await page.locator('header input').inputValue()
check('Project persists after reload', titleBefore === titleAfter, `${titleBefore} / ${titleAfter}`)
const blockCount = await page.locator('[data-elid]').count()
check('Screenplay content persists after reload', blockCount > 3, `blocks=${blockCount}`)

// ---------- PDF export ----------
const dlPdf = page.waitForEvent('download', { timeout: 10000 })
await page.click('text=Export')
await page.getByText('PDF', { exact: true }).click()
const pdfDownload = await dlPdf
check('PDF export downloads', pdfDownload.suggestedFilename().endsWith('.pdf'), pdfDownload.suggestedFilename())
const pdfPath = '/tmp/reel-test.pdf'
await pdfDownload.saveAs(pdfPath)
const pdfBytes = readFileSync(pdfPath)
const pdfDoc = await PDFDocument.load(pdfBytes)
check('PDF is valid with title page + screenplay', pdfDoc.getPageCount() >= 2, `pages=${pdfDoc.getPageCount()}`)

// ---------- Plain text export ----------
const dlTxt = page.waitForEvent('download', { timeout: 10000 })
await page.click('text=Export')
await page.getByText('Plain text', { exact: true }).click()
const txtDownload = await dlTxt
check('Text export downloads', txtDownload.suggestedFilename().endsWith('.txt'), txtDownload.suggestedFilename())

// ---------- Click blank paper below the last element to keep writing ----------
await blocks.last().scrollIntoViewIfNeeded()
await page.waitForTimeout(250)
const lastBox = await blocks.last().boundingBox()
const paperBox = await page.locator('.paper-sheen').boundingBox()
await page.mouse.click(paperBox.x + 300, lastBox.y + lastBox.height + 60)
await page.keyboard.type('THE END', { delay: 5 })
await page.waitForTimeout(300)
check('Click below last block continues writing', (await blocks.last().textContent()).includes('THE END'))

// ---------- Dark mode ----------
await page.locator('header button[title="Dark mode"]').click()
await page.waitForTimeout(200)
check('Dark mode applied', await page.evaluate(() => document.documentElement.classList.contains('dark')))
await page.locator('header button[title="Light mode"]').click()
await page.waitForTimeout(200)

// ---------- Back to dashboard: card + duplicate ----------
await page.locator('header button[title="Back to projects"]').click()
await page.waitForSelector('text=Projects')
const cardCount = await page.locator('text=The Lighthouse').count()
check('Project card on dashboard', cardCount >= 1)
await page.locator('div').filter({ hasText: 'The Lighthouse' }).last().hover()
await page.waitForTimeout(300)
// open card menu (MoreHorizontal) then duplicate
const card = page.locator('div').filter({ hasText: 'The Lighthouse' }).last()
await card.locator('button[title="Project options"]').click()
await page.click('text=Duplicate')
await page.waitForTimeout(300)
check('Duplicate creates a copy', (await page.locator('text=The Lighthouse (Copy)').count()) >= 1)

// ---------- Sample project on fresh profile ----------
const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page2 = await ctx2.newPage()
await page2.goto(url, { waitUntil: 'networkidle' })
await page2.waitForSelector('text=Write scripts')
await page2.click('text=Start writing for free')
await page2.waitForSelector('text=Sample script')
await page2.click('text=Sample script')
await page2.waitForSelector('[data-elid]', { timeout: 8000 })
await page2.waitForTimeout(400)
const sampleAside = await page2.locator('aside').first().textContent()
check(
  'Sample project has multiple pages',
  sampleAside.includes('Page 1') && sampleAside.includes('TRAIN STATION'),
  sampleAside.slice(0, 120).replace(/\n/g, ' '),
)
await ctx2.close()

// ---------- Runtime errors ----------
const realErrors = errors.filter((e) => !e.includes('Download the React DevTools'))
check('No console/runtime errors', realErrors.length === 0, realErrors.slice(0, 3).join(' | '))

await browser.close()

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
