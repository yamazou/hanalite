import { chromium } from 'playwright'

const url = process.argv[2] ?? 'http://localhost:5181/masters/item-processes'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const errors = []
page.on('pageerror', (err) => errors.push(`pageerror: ${err.stack ?? err}`))
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console: ${msg.text()}`)
})
try {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(3000)
  const rootText = await page.locator('#root').innerText().catch(() => '')
  const hasTitle = await page.locator('text=Item Processes').count()
  console.log(
    JSON.stringify(
      {
        url,
        errors,
        hasTitle,
        rootTextLen: rootText.length,
        rootPreview: rootText.slice(0, 300),
      },
      null,
      2
    )
  )
} catch (e) {
  console.log(JSON.stringify({ url, fatal: String(e), errors }, null, 2))
}
await browser.close()
