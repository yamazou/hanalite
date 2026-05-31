import { chromium } from 'playwright'

const url = 'http://localhost:5181/masters/item-processes'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const errors = []
page.on('pageerror', (err) => errors.push(`pageerror: ${err.stack ?? err}`))
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console: ${msg.text()}`)
})

await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(2000)

// Click first non-empty output item row (skip header)
const outputRows = page.locator('[data-production-grid="final-item"] tbody tr')
const rowCount = await outputRows.count()
for (let i = 0; i < rowCount; i++) {
  const row = outputRows.nth(i)
  const text = (await row.innerText()).trim()
  if (text && !text.includes('Select')) {
    await row.click()
    break
  }
}
await page.waitForTimeout(1500)

// Click last process row
const processRows = page.locator('[data-production-grid="process"] tbody tr')
const procCount = await processRows.count()
if (procCount > 0) {
  await processRows.nth(procCount - 1).click()
}
await page.waitForTimeout(1000)

// Clear first input item code if present
const itemCdInput = page.locator('[data-production-grid="input"] input.erp-grid-input').first()
if (await itemCdInput.count()) {
  await itemCdInput.click({ clickCount: 3 })
  await itemCdInput.fill('')
  await itemCdInput.blur()
}
await page.waitForTimeout(2000)

const rootText = await page.locator('#root').innerText().catch(() => '')
console.log(
  JSON.stringify(
    {
      errors,
      rootTextLen: rootText.length,
      hasItemProcesses: rootText.includes('Item Processes'),
      hasProcess: rootText.includes('Process'),
      rootPreview: rootText.slice(0, 400),
    },
    null,
    2
  )
)
await browser.close()
