import * as React from 'react'
import { type LoaderFunctionArgs, redirect, useLoaderData } from 'react-router'
import { db } from '~/db.server'
import type { InstructionSlim } from '~/types'
import { getEmployeeUser, type SessionUser } from '~/utils/session.server'
import { selectMany } from '../utils/queryHelpers'

interface InstructionMedium extends InstructionSlim {
  parent_id: number
  after_id: number
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  let user: SessionUser
  try {
    user = await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  const instructions = await selectMany<InstructionMedium>(
    db,
    'SELECT id, title, parent_id, after_id, rich_text from instructions WHERE company_id = ?',
    [user.company_id],
  )
  return { instructions }
}

export default function TeachMode() {
  const { instructions } = useLoaderData() as { instructions: InstructionMedium[] }

  const [mcq, setMcq] = React.useState<{
    question?: string
    options?: Record<string, string>
    correct?: string
  } | null>(null)
  const [selected, setSelected] = React.useState<string | null>(null)
  const [submitted, setSubmitted] = React.useState(false)
  const [loadingMCQ, setLoadingMCQ] = React.useState(false)
  const [expanded, setExpanded] = React.useState<Record<number, boolean>>({})

  const parentKey = (pid: number | null) => (pid && pid !== 0 ? pid : null)

  const siblingsByParent = React.useMemo(() => {
    const map = new Map<number | null, InstructionMedium[]>()
    for (const i of instructions) {
      const k = parentKey(i.parent_id)
      const arr = map.get(k) ?? []
      arr.push(i)
      map.set(k, arr)
    }
    return map
  }, [instructions])

  const orderSiblings = React.useCallback((list: InstructionMedium[]) => {
    if (list.length <= 1) return list.slice()
    const idSet = new Set(list.map(i => i.id))
    const head = list.find(i => !i.after_id || !idSet.has(i.after_id)) ?? null
    if (!head) return list.slice().sort((a, b) => a.id - b.id)

    const result: InstructionMedium[] = []
    const visited = new Set<number>()
    let current: InstructionMedium | null = head

    while (current && !visited.has(current.id)) {
      result.push(current)
      visited.add(current.id)
      current =
        list.find(
          i => i.after_id === result[result.length - 1].id && !visited.has(i.id),
        ) ?? null
    }

    const leftovers = list.filter(i => !visited.has(i.id)).sort((a, b) => a.id - b.id)
    return result.concat(leftovers)
  }, [])

  const childrenOf = React.useCallback(
    (pid: number | null) => orderSiblings(siblingsByParent.get(parentKey(pid)) ?? []),
    [orderSiblings, siblingsByParent],
  )

  const roots = childrenOf(null)

  const toggleExpand = (id: number) =>
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  const styles = {
    rootBox: {
      border: '2px solid #333',
      borderRadius: 8,
      padding: 12,
      marginBottom: 20,
      background: '#fff',
    } as React.CSSProperties,
    item: (depth: number) =>
      ({
        marginLeft: depth === 0 ? 0 : 16,
        paddingLeft: depth === 0 ? 0 : 10,
        borderLeft: depth === 0 ? undefined : '2px solid #ddd',
        marginTop: depth === 0 ? 0 : 10,
        fontSize: depth === 0 ? '1rem' : `${Math.max(0.8, 1 - depth * 0.08)}rem`,
        lineHeight: 1.5,
      }) as React.CSSProperties,
    titleRow: {
      display: 'flex',
      alignItems: 'center',
      cursor: 'pointer',
    } as React.CSSProperties,
    arrow: {
      display: 'inline-block',
      width: '1em',
      textAlign: 'center',
      marginRight: 6,
      userSelect: 'none',
    } as React.CSSProperties,
    title: { fontWeight: 700, margin: 0 } as React.CSSProperties,
  }

  const InstructionNode: React.FC<{ node: InstructionMedium; depth: number }> = ({
    node,
    depth,
  }) => {
    const children = childrenOf(node.id)
    const hasChildren = children.length > 0
    const isOpen = expanded[node.id] ?? false

    return (
      <div style={styles.item(depth)}>
        <div
          style={styles.titleRow}
          onClick={() => hasChildren && toggleExpand(node.id)}
        >
          {hasChildren ? (
            <span style={styles.arrow}>{isOpen ? '▼' : '▶'}</span>
          ) : (
            <span style={styles.arrow} />
          )}
          <p style={styles.title}>{node.title ?? '(no title)'}</p>
        </div>
        <div dangerouslySetInnerHTML={{ __html: node.rich_text }} />
        {hasChildren && isOpen && (
          <div>
            {children.map(child => (
              <InstructionNode key={child.id} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  async function generateMCQFromInstructions(prompt: InstructionMedium[]) {
    const formatInstructions = (instr: InstructionMedium[]) =>
      instr
        .map(i => `${i.title}:\n${i.rich_text.replace(/<[^>]+>/g, '').trim()}\n`)
        .join('\n')

    const serializedPrompt = formatInstructions(prompt)
    console.log('[DEBUG] Serialized prompt:', serializedPrompt)

    setLoadingMCQ(true)
    let liveAnswer = ''

    try {
      const res = await fetch(
        `/api/chat?query=${encodeURIComponent(serializedPrompt)}&isNew=true`,
      )
      console.log('[DEBUG] Fetch response:', res)

      if (!res.body) {
        console.error('[ERROR] No response body!')
        setLoadingMCQ(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let done = false

      while (!done) {
        const { value, done: readerDone } = await reader.read()
        done = readerDone
        if (value) {
          const chunk = decoder.decode(value, { stream: true })
          console.log('[DEBUG] Chunk received:', chunk)

          const lines = chunk.split(/\r?\n/).filter(line => line.startsWith('data:'))
          for (const line of lines) {
            const data = line.replace(/^data:\s*/, '')
            if (data === 'DONE') continue
            liveAnswer += data

            setMcq(prev => ({
              ...(prev || {}),
              question: liveAnswer.replace(/\n/g, '<br>'),
            }))
          }
        }
      }

      console.log('[DEBUG] Full liveAnswer received:', liveAnswer)

      // Try parsing JSON at the end
      try {
        const parsed = JSON.parse(liveAnswer.replace(/\[DONE\].*$/s, '').trim())
        console.log('[DEBUG] Parsed MCQ JSON:', parsed)
        setMcq(parsed)
      } catch (err) {
        console.warn('[WARN] Could not parse JSON at end, using live text.', err)
      }
    } catch (err) {
      console.error('[ERROR] Error fetching MCQ:', err)
    } finally {
      setLoadingMCQ(false)
    }
  }

  return (
    <div style={{ padding: 20 }}>
      {roots.map(root => (
        <div key={root.id} style={styles.rootBox}>
          <InstructionNode node={root} depth={0} />
        </div>
      ))}

      <button
        onClick={() => generateMCQFromInstructions(instructions)}
        disabled={loadingMCQ}
        style={{
          marginTop: 20,
          padding: '8px 16px',
          cursor: loadingMCQ ? 'not-allowed' : 'pointer',
        }}
      >
        {loadingMCQ ? 'Generating...' : 'Generate Question'}
      </button>

      {mcq && (
        <div
          style={{
            marginTop: 40,
            padding: 20,
            border: '2px solid #888',
            borderRadius: 8,
          }}
        >
          <h3>Question:</h3>
          <p dangerouslySetInnerHTML={{ __html: mcq.question || '' }} />

          {mcq.options ? (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {Object.entries(mcq.options).map(([key, value]) => (
                <li key={key}>
                  <label>
                    <input
                      type='radio'
                      name='mcq'
                      value={key}
                      checked={selected === key}
                      onChange={() => setSelected(key)}
                    />
                    {key}: {value}
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <p>No options available for this question.</p>
          )}

          {mcq.correct && (
            <button
              onClick={() => {
                if (!selected) return alert('Select an option first')
                setSubmitted(true)
              }}
              style={{ marginTop: 10, padding: '6px 12px', cursor: 'pointer' }}
            >
              Submit
            </button>
          )}

          {submitted && selected && mcq.correct && (
            <p style={{ fontWeight: 700, marginTop: 10 }}>
              {selected === mcq.correct
                ? '✅ Correct!'
                : `❌ Incorrect, correct answer: ${mcq.correct}`}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
