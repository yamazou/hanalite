import { chromium } from 'playwright'

const pages = [
  'http://localhost:5181/masters/item-processes',
  'http://localhost:5181/production/orders',
]

for (const url of pages) {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (err) => errors.push(String(err.stack ?? err)))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(1500)

    if (url.includes('item-processes')) {
      await page.getByRole('button', { name: 'Finished Goods' }).click()
      await page.waitForTimeout(500)
      const row = page.locator('[data-production-grid="final-item"] tbody tr').filter({ hasText: 'HEATSINK' }).first()
      if (await row.count()) {
        await row.click()
        await page.waitForTimeout(2000)
      }
      const procRows = page.locator('[data-production-grid="process"] tbody tr')
      const n = await procRows.count()
      if (n > 0) await procRows.nth(n - 1).click()
      await page.waitForTimeout(1000)
      const inp = page.locator('[data-production-grid="input"] input.erp-grid-input').first()
      if (await inp.count()) {
        await inp.fill('')
        await inp.blur()
      }
    } else {
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
    }

    await page.waitForTimeout(2000)
    const rootText = await page.locator('#root').innerText().catch(() => '')
    console.log(
      JSON.stringify(
        {
          url,
          errors: errors.slice(0, 10),
          errorCount: errors.length,
          rootTextLen: rootText.length,
          blank: rootText.length < 200,
        },
        null,
        2
      )
    )
  } catch (e) {
    console.log(JSON.stringify({ url, fatal: String(e), errors: errors.slice(0, 5) }, null, 2))
  }
  await browser.close()
}
