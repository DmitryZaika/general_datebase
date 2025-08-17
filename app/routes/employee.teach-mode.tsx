import * as React from 'react'
import { type LoaderFunctionArgs, redirect, useLoaderData } from 'react-router'
import { Label } from '@/components/ui/label'
import { Button } from '~/components/ui/button'
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

  function cleanJSON(value: string) {
    if (value === '') return null
    try {
      return JSON.parse(value)
    } catch (error) {
      return null
    }
  }

  // Function to get random content from instructions
  const getRandomInstructionContent = React.useCallback(() => {
    if (instructions.length === 0) return null

    // Get a random instruction
    const randomInstruction =
      instructions[Math.floor(Math.random() * instructions.length)]

    // Clean HTML content for better processing
    const cleanText = randomInstruction.rich_text
      ?.replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    return {
      title: randomInstruction.title,
      content: cleanText || randomInstruction.title,
    }
  }, [instructions])

  const handleFormSubmit = async () => {
    if (loadingMCQ) return

    setLoadingMCQ(true)
    setText('')
    setSelected('')
    setSubmitted(false)

    // Get random content from instructions
    const randomContent = getRandomInstructionContent()

    if (!randomContent) {
      alert('No instruction content available to generate questions from')
      setLoadingMCQ(false)
      return
    }

    // Create a dynamic prompt based on the actual instruction content
    const prompt = `You are a question generator. You MUST return JSON ALWAYS. You will return a JSON object with the following keys: "question", "options", and "answer".

Based on the following educational content, create a multiple choice question:

Title: ${randomContent.title}
Content: ${randomContent.content}

Guidelines:
- Create a question that tests understanding of the key concepts from this content
- Provide 4 plausible answer options
- Make sure only one option is correct
- The question should be clear and educational

Return ONLY valid JSON in this exact format:
{
  "question": "Your question here?",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "answer": "The correct option"
}

Examples of good questions:
{
  "question": "What is the main topic discussed in this content?",
  "options": ["Topic A", "Topic B", "Topic C", "Topic D"],
  "answer": "Topic B"
}

Now generate a question based on the provided content.`

    const query = encodeURIComponent(prompt)
    const sse = new EventSource(`/api/chat?query=${query}&isNew=true`)

    sse.addEventListener('message', event => {
      if (event.data === DONE_KEY) {
        sse.close()
        setLoadingMCQ(false)
      } else {
        setText(prevResults => prevResults + event.data)
      }
    })

    sse.addEventListener('error', () => {
      sse.close()
      setLoadingMCQ(false)
    })
  }

  const values = cleanJSON(text)

  return (
    <div style={{ padding: 20 }}>
      {roots.map(root => (
        <div key={root.id} style={styles.rootBox}>
          <InstructionNode node={root} depth={0} />
        </div>
      ))}

      <Button onClick={handleFormSubmit} disabled={loadingMCQ}>
        {loadingMCQ ? 'Generating Question...' : 'Generate Random Question'}
      </Button>

      {loadingMCQ && (
        <div style={{ marginTop: 10, color: '#666' }}>
          <p>Creating a question from your course content...</p>
        </div>
      )}

      {text && !values && (
        <div
          style={{
            marginTop: 10,
            padding: 10,
            backgroundColor: '#f5f5f5',
            borderRadius: 4,
          }}
        >
          <p>Raw response: {text}</p>
        </div>
      )}

      {values !== null && (
        <div
          className='mt-5 p-5'
          style={{
            border: '2px solid #888',
            borderRadius: 8,
            marginTop: 20,
          }}
        >
          <h2 style={{ marginBottom: 15 }}>{values.question}</h2>
          {values.options?.map((answer: string, index: number) => (
            <div key={index} style={{ marginBottom: 8 }}>
              <label
                style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
              >
                <input
                  type='radio'
                  name='mcq'
                  value={answer}
                  checked={selected === answer}
                  onChange={() => {
                    setSelected(answer)
                    setSubmitted(false)
                  }}
                  style={{ marginRight: 8 }}
                />
                {answer}
              </label>
            </div>
          ))}

          <button
            onClick={() => {
              if (!selected) {
                alert('Please select an option first')
                return
              }
              setSubmitted(true)
            }}
            style={{
              marginTop: 15,
              padding: '8px 16px',
              cursor: 'pointer',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: 4,
            }}
            disabled={!selected}
          >
            Submit Answer
          </button>

          {submitted && selected && (
            <div
              style={{
                marginTop: 15,
                padding: 10,
                borderRadius: 4,
                backgroundColor: selected === values.answer ? '#d4edda' : '#f8d7da',
                border:
                  selected === values.answer
                    ? '1px solid #c3e6cb'
                    : '1px solid #f5c6cb',
              }}
            >
              <p style={{ margin: 0, fontWeight: 700 }}>
                {selected === values.answer
                  ? '✅ Correct! Well done!'
                  : `❌ Incorrect. The correct answer is: ${values.answer}`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
