import { chromium } from 'playwright'

const url = 'http://localhost:5181/production/orders'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const errors = []
page.on('pageerror', (err) => errors.push(String(err.message)))
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text())
})
await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(1500)
const orderRow = page.locator('.erp-panel-orders-header tbody tr').nth(1)
if (await orderRow.count()) {
  await orderRow.click()
  await page.waitForTimeout(3000)
}
const inp = page.locator('[data-production-grid="input"] input.erp-grid-input').first()
if (await inp.count()) {
  await inp.fill('')
  await inp.blur()
}
await page.waitForTimeout(2000)
const rootText = await page.locator('#root').innerText().catch(() => '')
console.log(JSON.stringify({ errorCount: errors.length, errors: errors.slice(0, 3), rootTextLen: rootText.length }, null, 2))
await browser.close()
