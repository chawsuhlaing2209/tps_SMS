import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SmsJob } from '@sms/shared'

type GenerateMonthlyInvoicesJob = Extract<SmsJob, { name: 'generate-monthly-invoices' }>['data']

const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..')
const tsxBin = path.join(repoRoot, 'node_modules/.bin/tsx')
const cliScript = path.join(repoRoot, 'apps/api/src/finance/monthly-invoice-cli.ts')

export async function handleGenerateMonthlyInvoices(data: GenerateMonthlyInvoicesJob) {
  return new Promise<unknown>((resolve, reject) => {
    const child = spawn(tsxBin, [cliScript, JSON.stringify(data)], {
      cwd: repoRoot,
      env: process.env,
      stdio: ['ignore', 'pipe', 'inherit'],
    })

    let stdout = ''
    child.stdout.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString()
    })

    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`generate-monthly-invoices exited with code ${code}`))
        return
      }

      const trimmed = stdout.trim()
      if (!trimmed) {
        resolve(undefined)
        return
      }

      try {
        resolve(JSON.parse(trimmed))
      } catch {
        resolve(trimmed)
      }
    })
  })
}
