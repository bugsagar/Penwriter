import { chromium } from 'playwright'

const url = 'http://localhost:5173'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message))
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE:', m.text()) })

await page.goto(url, { waitUntil: 'networkidle' })
await page.click('text=Try sample')
await page.waitForSelector('[data-elid]', { timeout: 8000 })
await page.waitForTimeout(400)

const blocks = page.locator('[data-elid]')
const count = await blocks.count()
console.log('blocks:', count)

// 1) click into a middle block and type
await blocks.nth(1).click()
await page.keyboard.type('Hello world! ', { delay: 5 })
await page.waitForTimeout(200)
console.log('after typing in block1:', JSON.stringify((await blocks.nth(1).textContent()).slice(0, 40)))

// 2) click BELOW the last block (blank paper) and type — the reported gap
const lastBox = await blocks.nth(count - 1).boundingBox()
const paper = await page.locator('.paper-sheen').boundingBox()
const y = Math.min(lastBox.y + lastBox.height + 60, paper.y + paper.height - 20)
console.log('clicking below last block at', paper.x + 300, y)
await page.mouse.click(paper.x + 300, y)
await page.keyboard.type('Typing after clicking blank space ', { delay: 5 })
await page.waitForTimeout(300)
const countAfter = await blocks.count()
console.log('blocks after click-below+type:', countAfter)
const lastText = (await blocks.nth(countAfter - 1).textContent()) || ''
console.log('last block text:', JSON.stringify(lastText.slice(0, 40)))

await browser.close()
