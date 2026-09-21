import { chromium } from 'playwright'

const url = process.env.APP_URL || 'http://localhost:4173'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()

await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForSelector('text=Projects')
await page.screenshot({ path: '/tmp/shots/dashboard.png' })

await page.click('text=Try sample')
await page.waitForSelector('[data-elid]', { timeout: 8000 })
await page.waitForTimeout(600)
// click into first dialogue to show active state
await page.screenshot({ path: '/tmp/shots/editor-light.png', clip: { x: 220, y: 40, width: 1000, height: 700 } })

await page.locator('header button[title="Dark mode"]').click()
await page.waitForTimeout(400)
await page.screenshot({ path: '/tmp/shots/editor-dark.png', clip: { x: 220, y: 40, width: 1000, height: 700 } })
await page.locator('header button[title="Light mode"]').click()
await page.waitForTimeout(200)

await page.keyboard.press('ControlOrMeta+Shift+f')
await page.waitForTimeout(400)
await page.screenshot({ path: '/tmp/shots/writing-mode.png' })
await page.keyboard.press('ControlOrMeta+Shift+f')

await page.locator('header button[title="Back to projects"]').click()
await page.waitForSelector('text=Projects')
await page.click('text=New Screenplay')
await page.waitForSelector('text=Create Screenplay')
await page.screenshot({ path: '/tmp/shots/new-dialog.png', clip: { x: 300, y: 120, width: 600, height: 560 } })

await browser.close()
console.log('screenshots saved')
