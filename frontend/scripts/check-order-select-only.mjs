import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const errors = []
page.on('pageerror', (err) => errors.push(String(err.message)))
await page.goto('http://localhost:5181/production/orders', { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(1500)
const orderRow = page.locator('.erp-panel-orders-header tbody tr').nth(1)
if (await orderRow.count()) await orderRow.click()
await page.waitForTimeout(3000)
console.log(JSON.stringify({ errorCount: errors.length, errors: errors.slice(0, 3) }, null, 2))
await browser.close()
