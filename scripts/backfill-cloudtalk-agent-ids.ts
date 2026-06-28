// scripts/backfill-cloudtalk-agent-ids.ts
// One-shot script. Run via: bun scripts/backfill-cloudtalk-agent-ids.ts
//
// For every company with CloudTalk creds set, fetch the CloudTalk agent roster,
// match agents to CRM users by email (case-insensitive), and write the matched
// agent id into users.cloudtalk_agent_id for any user that doesn't already
// have one.
import dotenv from 'dotenv'

dotenv.config()

import { db } from '~/db.server'
import { fetchValue } from '~/utils/cloudtalk.server'
import { selectMany } from '~/utils/queryHelpers'

interface CompanyRow {
  id: number
  name: string
}

interface UserRow {
  id: number
  email: string
}

interface AgentRow {
  Agent: {
    id: number
    email: string
    firstname: string
    lastname: string
  }
}

async function main() {
  const companies = await selectMany<CompanyRow>(
    db,
    `SELECT id, name FROM company
      WHERE cloudtalk_access_key IS NOT NULL
        AND cloudtalk_access_secret IS NOT NULL`,
  )

  for (const c of companies) {
    process.stdout.write(`[${c.id}] ${c.name}: `)
    let items: AgentRow[] = []
    try {
      const { items: fetched } = await fetchValue<AgentRow>(
        'agents/index.json',
        c.id,
        {
          limit: 500,
        },
      )
      items = fetched
    } catch (err) {
      process.stdout.write(`failed to fetch agents: ${(err as Error).message}\n`)
      continue
    }
    const byEmail = new Map<string, AgentRow['Agent']>()
    const ambiguous: { email: string; agentIds: number[] }[] = []
    for (const row of items) {
      const email = row.Agent.email.toLowerCase()
      const existing = byEmail.get(email)
      if (existing) {
        const found = ambiguous.find(a => a.email === email)
        if (found) {
          found.agentIds.push(row.Agent.id)
        } else {
          ambiguous.push({ email, agentIds: [existing.id, row.Agent.id] })
        }
        continue // keep the first; warn about the duplicates
      }
      byEmail.set(email, row.Agent)
    }
    if (ambiguous.length > 0) {
      for (const a of ambiguous) {
        process.stdout.write(
          `  warning: email ${a.email} maps to multiple CloudTalk agents [${a.agentIds.join(', ')}] — keeping first; manual review needed\n`,
        )
      }
    }

    const users = await selectMany<UserRow>(
      db,
      `SELECT id, email FROM users
        WHERE company_id = ?
          AND (cloudtalk_agent_id IS NULL OR cloudtalk_agent_id = '')
          AND is_deleted = 0`,
      [c.id],
    )

    let matched = 0
    for (const u of users) {
      if (!u.email) continue
      const agent = byEmail.get(u.email.toLowerCase())
      if (!agent) continue
      await db.execute('UPDATE users SET cloudtalk_agent_id = ? WHERE id = ?', [
        String(agent.id),
        u.id,
      ])
      matched += 1
    }
    process.stdout.write(`matched ${matched} of ${users.length}\n`)
  }

  process.exit(0)
}

main().catch(err => {
  // biome-ignore lint/suspicious/noConsole: one-shot script entrypoint
  console.error(err)
  process.exit(1)
})
