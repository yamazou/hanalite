import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const errors = []
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console: ${msg.text()}`)
})

await page.goto('http://localhost:5181/production/new', { waitUntil: 'networkidle', timeout: 30000 })
await page.waitForTimeout(2000)

const metrics = await page.evaluate(() => {
  const split = document.querySelector('.erp-production-detail-split')
  const panel = document.querySelector('.erp-detail-panel')
  const process = document.querySelector('[data-production-grid="process"]')
  const rect = (el) => {
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { w: r.width, h: r.height, display: getComputedStyle(el).display, overflow: getComputedStyle(el).overflow }
  }
  return {
    split: rect(split),
    panel: rect(panel),
    process: rect(process),
    emptyText: document.querySelector('.erp-grid-empty')?.textContent?.trim() ?? null,
    titleBar: document.querySelector('.erp-panel-title-bar')?.textContent?.trim() ?? null,
  }
})

console.log(JSON.stringify({ metrics, errorCount: errors.length, errors }, null, 2))
await browser.close()
