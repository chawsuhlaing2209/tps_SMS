import 'dotenv/config'
import { runMonthlyInvoiceJob } from './monthly-invoice-runner.js'

const raw = process.argv[2]
if (!raw) {
  console.error('Usage: monthly-invoice-cli.ts <json>')
  process.exit(1)
}

const data = JSON.parse(raw) as Parameters<typeof runMonthlyInvoiceJob>[0]

runMonthlyInvoiceJob(data)
  .then((result) => {
    console.log(JSON.stringify(result))
    process.exit(0)
  })
  .catch((error: unknown) => {
    console.error(error)
    process.exit(1)
  })
