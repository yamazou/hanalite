import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const errors = []
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))

await page.goto('http://localhost:5181/production/orders', { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(1500)

// Open entry for first order if link exists, else click row and navigate
const entryLink = page.locator('a[href*="/production/new?id="]').first()
let entryUrl = 'http://localhost:5181/production/new'
if (await entryLink.count()) {
  entryUrl = await entryLink.getAttribute('href')
  if (entryUrl && !entryUrl.startsWith('http')) {
    entryUrl = `http://localhost:5181${entryUrl}`
  }
} else {
  const row = page.locator('.erp-panel-orders-header tbody tr').nth(1)
  if (await row.count()) {
    await row.dblclick().catch(() => row.click())
    await page.waitForTimeout(2000)
    entryUrl = page.url()
  }
}

if (entryUrl.includes('production/new') && entryUrl.includes('id=')) {
  await page.goto(entryUrl, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(3000)
}

const metrics = await page.evaluate(() => {
  const rect = (sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { w: Math.round(r.width), h: Math.round(r.height) }
  }
  return {
    url: location.href,
    split: rect('.erp-production-detail-split'),
    panel: rect('.erp-detail-panel'),
    process: rect('[data-production-grid="process"]'),
    input: rect('[data-production-grid="input"]'),
    tree: rect('.erp-production-detail-tree'),
    processRows: document.querySelectorAll('[data-production-grid="process"] tbody tr').length,
    emptyTexts: [...document.querySelectorAll('.erp-grid-empty')].map((el) => el.textContent?.trim()),
  }
})

console.log(JSON.stringify({ metrics, errorCount: errors.length, errors }, null, 2))
await browser.close()
