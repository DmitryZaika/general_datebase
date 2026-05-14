import * as readline from 'node:readline/promises'
import dotenv from 'dotenv'
import mysql from 'mysql2/promise'

dotenv.config()

const PROGRESS_EVERY = 25
const USAGE =
  'Usage: bun run scripts/cloudtalk-backfill.ts --company-id=<id> [--limit=<n>] [--dry-run] [--yes] [--verbose] [--rate-limit-rpm=<n>]'

interface Args {
  companyId: number
  limit?: number
  dryRun: boolean
  yes: boolean
  verbose: boolean
  rateLimitRpm?: number
}

interface CompanyRow extends mysql.RowDataPacket {
  id: number
  name: string
  cloudtalk_access_key: string | null
}

function parseArgs(argv: string[]): Args {
  let companyId: number | undefined
  let limit: number | undefined
  let dryRun = false
  let yes = false
  let verbose = false
  let rateLimitRpm: number | undefined
  for (const arg of argv.slice(2)) {
    const [key, value] = arg.split('=')
    if (key === '--company-id') companyId = Number.parseInt(value, 10)
    else if (key === '--limit') limit = Number.parseInt(value, 10)
    else if (key === '--dry-run') dryRun = true
    else if (key === '--yes') yes = true
    else if (key === '--verbose') verbose = true
    else if (key === '--rate-limit-rpm') rateLimitRpm = Number.parseInt(value, 10)
  }
  if (!companyId || Number.isNaN(companyId)) {
    console.error(USAGE)
    process.exit(1)
  }
  return { companyId, limit, dryRun, yes, verbose, rateLimitRpm }
}

async function loadCompany(
  pool: mysql.Pool,
  companyId: number,
): Promise<CompanyRow | null> {
  const [rows] = await pool.query<CompanyRow[]>(
    'SELECT id, name, cloudtalk_access_key FROM company WHERE id = ?',
    [companyId],
  )
  return rows[0] ?? null
}

async function loadCustomerIds(
  pool: mysql.Pool,
  companyId: number,
  limit: number | undefined,
): Promise<number[]> {
  const sqlLimit = limit ? `LIMIT ${limit}` : ''
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT c.id
       FROM customers c
       LEFT JOIN cloudtalk_contacts cc ON cc.customer_id = c.id
      WHERE c.company_id = ?
        AND c.deleted_at IS NULL
        AND cc.id IS NULL
        AND (c.phone IS NOT NULL OR c.phone_2 IS NOT NULL)
      ORDER BY c.id ASC
      ${sqlLimit}`,
    [companyId],
  )
  return rows.map(r => r.id as number)
}

async function confirmInteractive(expected: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    console.error(
      'Refusing to run non-interactively without --yes. Pass --yes to skip the confirm prompt.',
    )
    return false
  }
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  try {
    const answer = await rl.question(
      `Type the company name exactly to confirm (${expected}): `,
    )
    return answer.trim() === expected.trim()
  } finally {
    rl.close()
  }
}

async function acquireLock(
  conn: mysql.PoolConnection,
  name: string,
): Promise<boolean> {
  const [rows] = await conn.query<mysql.RowDataPacket[]>(
    'SELECT GET_LOCK(?, 0) AS got',
    [name],
  )
  return rows[0]?.got === 1
}

function printSummary(args: Args, company: CompanyRow, total: number): void {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`Database host: ${process.env.DB_HOST ?? '(unset)'}`)
  console.log(`Database name: ${process.env.DB_DATABASE ?? '(unset)'}`)
  console.log(`Company:       ${company.name} (id=${company.id})`)
  console.log(
    `Customers to sync: ${total}${args.limit ? ` (limit=${args.limit})` : ''}`,
  )
  console.log(`Mode:          ${args.dryRun ? 'DRY RUN' : 'WRITE'}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

async function runBackfill(
  ids: number[],
  verbose: boolean,
): Promise<{ ok: number; failed: number }> {
  const { syncCustomerToCloudTalk } = await import(
    '../app/utils/cloudtalkContactSync.server'
  )
  const { resetRequestStats, summarizeRequestStats } = await import(
    '../app/utils/cloudtalk.server'
  )
  resetRequestStats()
  let ok = 0
  let failed = 0
  const startedAt = Date.now()
  for (const [i, id] of ids.entries()) {
    const customerStartedAt = Date.now()
    try {
      await syncCustomerToCloudTalk(id)
      ok += 1
    } catch (error) {
      console.error(`Customer ${id} failed:`, error)
      failed += 1
    }
    if (verbose) {
      console.error(`[customer] id=${id} ${Date.now() - customerStartedAt}ms`)
    }
    if ((i + 1) % PROGRESS_EVERY === 0) {
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0)
      console.log(
        `Progress: ${i + 1}/${ids.length} (ok=${ok}, failed=${failed}, ${elapsed}s elapsed)`,
      )
    }
  }
  const totalSeconds = (Date.now() - startedAt) / 1000
  const rate = ids.length / (totalSeconds / 60)
  console.log(
    `\nWall time: ${totalSeconds.toFixed(1)}s (${rate.toFixed(1)} customers/min)`,
  )
  console.log(summarizeRequestStats())
  return { ok, failed }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv)
  if (args.verbose) process.env.CLOUDTALK_VERBOSE = '1'
  if (args.rateLimitRpm) {
    process.env.CLOUDTALK_RATE_LIMIT_RPM = String(args.rateLimitRpm)
  }
  const pool = mysql.createPool({
    user: process.env.DB_USER,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
  })

  try {
    const company = await loadCompany(pool, args.companyId)
    if (!company) {
      console.error(`Company ${args.companyId} not found`)
      process.exit(1)
    }
    if (!company.cloudtalk_access_key) {
      console.error(
        `Company ${args.companyId} (${company.name}) has no cloudtalk_access_key — refusing to run.`,
      )
      process.exit(1)
    }

    const ids = await loadCustomerIds(pool, args.companyId, args.limit)
    printSummary(args, company, ids.length)

    if (ids.length === 0) {
      console.log('Nothing to do.')
      return
    }
    if (args.dryRun) return

    if (!args.yes && !(await confirmInteractive(company.name))) {
      console.error('Confirmation failed — aborting.')
      process.exit(1)
    }

    const lockName = `cloudtalk_backfill_${args.companyId}`
    const lockConn = await pool.getConnection()
    try {
      if (!(await acquireLock(lockConn, lockName))) {
        console.error(
          `Another backfill is already running for company ${args.companyId}. Refusing.`,
        )
        process.exit(1)
      }
      const { ok, failed } = await runBackfill(ids, args.verbose)
      console.log(`Done. ok=${ok}, failed=${failed}, total=${ids.length}`)
    } finally {
      await lockConn.query('SELECT RELEASE_LOCK(?)', [lockName]).catch(() => undefined)
      lockConn.release()
    }
  } finally {
    await pool.end()
  }
}

main().catch(error => {
  console.error('Backfill crashed:', error)
  process.exit(1)
})
