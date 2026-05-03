import * as readline from 'node:readline/promises'
import dotenv from 'dotenv'
import mysql from 'mysql2/promise'

dotenv.config()

interface Args {
  companyId: number
  limit?: number
  dryRun: boolean
  yes: boolean
}

function parseArgs(argv: string[]): Args {
  let companyId: number | undefined
  let limit: number | undefined
  let dryRun = false
  let yes = false
  for (const arg of argv.slice(2)) {
    const [key, value] = arg.split('=')
    if (key === '--company-id') companyId = Number.parseInt(value, 10)
    else if (key === '--limit') limit = Number.parseInt(value, 10)
    else if (key === '--dry-run') dryRun = true
    else if (key === '--yes') yes = true
  }
  if (!companyId || Number.isNaN(companyId)) {
    console.error(
      'Usage: bun run scripts/cloudtalk-backfill.ts --company-id=<id> [--limit=<n>] [--dry-run] [--yes]',
    )
    process.exit(1)
  }
  return { companyId, limit, dryRun, yes }
}

interface CompanyRow extends mysql.RowDataPacket {
  id: number
  name: string
  cloudtalk_access_key: string | null
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

async function main() {
  const { companyId, limit, dryRun, yes } = parseArgs(process.argv)
  const pool = mysql.createPool({
    user: process.env.DB_USER,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
  })

  const company = await loadCompany(pool, companyId)
  if (!company) {
    console.error(`Company ${companyId} not found`)
    await pool.end()
    process.exit(1)
  }
  if (!company.cloudtalk_access_key) {
    console.error(
      `Company ${companyId} (${company.name}) has no cloudtalk_access_key — refusing to run.`,
    )
    await pool.end()
    process.exit(1)
  }

  const ids = await loadCustomerIds(pool, companyId, limit)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`Database host: ${process.env.DB_HOST ?? '(unset)'}`)
  console.log(`Database name: ${process.env.DB_DATABASE ?? '(unset)'}`)
  console.log(`Company:       ${company.name} (id=${company.id})`)
  console.log(`Customers to sync: ${ids.length}${limit ? ` (limit=${limit})` : ''}`)
  console.log(`Mode:          ${dryRun ? 'DRY RUN' : 'WRITE'}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  if (ids.length === 0) {
    console.log('Nothing to do.')
    await pool.end()
    return
  }
  if (dryRun) {
    await pool.end()
    return
  }

  if (!yes) {
    const ok = await confirmInteractive(company.name)
    if (!ok) {
      console.error('Confirmation failed — aborting.')
      await pool.end()
      process.exit(1)
    }
  }

  // Acquire a per-company advisory lock so two backfill processes can't run
  // against the same company concurrently. The lock auto-releases when the
  // connection is closed; we hold it on a dedicated connection for the run.
  const lockName = `cloudtalk_backfill_${companyId}`
  const lockConn = await pool.getConnection()
  try {
    const [lockRows] = await lockConn.query<mysql.RowDataPacket[]>(
      'SELECT GET_LOCK(?, 0) AS got',
      [lockName],
    )
    if (lockRows[0]?.got !== 1) {
      console.error(
        `Another backfill is already running for company ${companyId}. Refusing.`,
      )
      lockConn.release()
      await pool.end()
      process.exit(1)
    }
  } catch (error) {
    console.error('Failed to acquire advisory lock:', error)
    lockConn.release()
    await pool.end()
    process.exit(1)
  }

  const { syncCustomerToCloudTalk } = await import(
    '../app/utils/cloudtalkContactSync.server'
  )

  let ok = 0
  let failed = 0
  const startedAt = Date.now()
  try {
    for (const [i, id] of ids.entries()) {
      try {
        await syncCustomerToCloudTalk(id)
        ok += 1
      } catch (error) {
        console.error(`Customer ${id} failed:`, error)
        failed += 1
      }
      if ((i + 1) % 25 === 0) {
        const elapsed = ((Date.now() - startedAt) / 1000).toFixed(0)
        console.log(
          `Progress: ${i + 1}/${ids.length} (ok=${ok}, failed=${failed}, ${elapsed}s elapsed)`,
        )
      }
      // Two API calls per customer (search + create/update). Pace at ~2.2s
      // per customer to stay under CloudTalk's 60 req/min/company limit.
      await new Promise(resolve => setTimeout(resolve, 2200))
    }
    console.log(`Done. ok=${ok}, failed=${failed}, total=${ids.length}`)
  } finally {
    try {
      await lockConn.query('SELECT RELEASE_LOCK(?)', [lockName])
    } catch {
      // best-effort; the lock auto-releases when the connection closes
    }
    lockConn.release()
    await pool.end()
  }
}

main().catch(error => {
  console.error('Backfill crashed:', error)
  process.exit(1)
})
