import * as React from 'react'
import { type LoaderFunctionArgs, redirect, useLoaderData } from 'react-router'
import { db } from '~/db.server'
import type { InstructionSlim } from '~/types'
import { DONE_KEY } from '~/utils/constants'
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

  const [text, setText] = React.useState('')
  const [selected, setSelected] = React.useState<string>('')
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

  const handleFormSubmit = async () => {
    setText('')
    const prompt = `
      You are a question generator. You MUST return JSON ALWAYS. You will return a JSON
      object with the following keys: "question", "options", and "answer".
      The "question" key should contain a string representing the question.
      The "options" key should contain an array of strings representing the answer options.
      The "answer" key should contain a string representing the correct answer.

      Here are some examples:
      {
        "question": "What is the capital of France?",
        "options": ["Paris", "London", "Berlin", "Madrid"],
        "answer": "Paris"
      }

      {
        "question": "What is the capital of Spain?",
        "options": ["Paris", "London", "Berlin", "Madrid"],
        "answer": "Madrid"
      }
     `
    const query = encodeURIComponent(prompt)
    const sse = new EventSource(`/api/chat?query=${query}&isNew=true`)

    sse.addEventListener('message', event => {
      if (event.data === DONE_KEY) {
        sse.close()
      } else {
        setText(prevResults => prevResults + event.data)
      }
    })

    sse.addEventListener('error', () => {
      sse.close()
    })
  }

  return (
    <div style={{ padding: 20 }}>
      {roots.map(root => (
        <div key={root.id} style={styles.rootBox}>
          <InstructionNode node={root} depth={0} />
        </div>
      ))}

      <button
        onClick={handleFormSubmit}
        disabled={loadingMCQ}
        style={{
          marginTop: 20,
          padding: '8px 16px',
          cursor: loadingMCQ ? 'not-allowed' : 'pointer',
        }}
      >
        {loadingMCQ ? 'Generating...' : 'Generate Question'}
      </button>

      {true && (
        <div
          className='mt-5 p-5'
          style={{
            border: '2px solid #888',
            borderRadius: 8,
          }}
        >
          <h3>Question:</h3>
          <p>{text}</p>

          {true && (
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

          {submitted && selected && (
            <p style={{ fontWeight: 700, marginTop: 10 }}>
              {selected === 'hello'
                ? '✅ Correct!'
                : `❌ Incorrect, correct answer: 6}`}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
