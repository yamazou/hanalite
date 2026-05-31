import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const pageErrors = []
const consoleErrors = []
page.on('pageerror', (err) => pageErrors.push(String(err.message)))
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text())
})
await page.goto('http://localhost:5181/masters/item-processes', { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(1500)
await page.getByRole('button', { name: 'Finished Goods' }).click()
await page.waitForTimeout(500)
const row = page.locator('[data-production-grid="final-item"] tbody tr').filter({ hasText: 'HEATSINK' }).first()
if (await row.count()) {
  await row.click()
  await page.waitForTimeout(2500)
}
const procRows = page.locator('[data-production-grid="process"] tbody tr')
const n = await procRows.count()
if (n > 0) await procRows.nth(n - 1).click()
await page.waitForTimeout(1000)

// Clear item code, name, qty
for (const sel of [
  '[data-production-grid="input"] input.erp-grid-input',
]) {
  const inputs = page.locator(sel)
  const count = await inputs.count()
  for (let i = 0; i < count; i++) {
    await inputs.nth(i).fill('')
    await inputs.nth(i).blur()
  }
}
await page.waitForTimeout(2000)
const rootText = await page.locator('#root').innerText().catch(() => '')
console.log(
  JSON.stringify(
    {
      pageErrorCount: pageErrors.length,
      consoleErrorCount: consoleErrors.length,
      pageErrors,
      consoleErrors: consoleErrors.slice(0, 5),
      rootTextLen: rootText.length,
      hasProcess: rootText.includes('Process'),
    },
    null,
    2
  )
)
await browser.close()
