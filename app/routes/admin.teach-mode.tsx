import * as React from 'react'
import {
  type ActionFunctionArgs,
  Form,
  type LoaderFunctionArgs,
  redirect,
  useActionData,
  useLoaderData,
} from 'react-router'
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

export const action = async ({ request }: ActionFunctionArgs) => {
  let user: SessionUser
  try {
    user = await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  const formData = await request.formData()
  const questionText = formData.get('questionText') as string
  const optionsString = formData.get('options') as string
  const options = optionsString.split(',').map(s => s.trim())
  // const options = JSON.parse(formData.get('options') as string) as string[]
  const correctAnswer = formData.get('correctAnswer') as string
  const instructionId = parseInt(formData.get('instructionId') as string)

  if (!questionText || !options || !correctAnswer || !instructionId) {
    return { error: 'Missing required question data' }
  }

  // Validate that the instruction exists
  try {
    const [instructionCheck] = await db.execute(
      'SELECT id FROM instructions WHERE id = ? AND company_id = ?',
      [instructionId, user.company_id],
    )

    if (!instructionCheck || (instructionCheck as any).length === 0) {
      return {
        error: 'Invalid instruction ID or instruction does not belong to your company',
      }
    }
  } catch (error) {
    console.error('Error validating instruction:', error)
    return { error: 'Error validating instruction' }
  }

  try {
    console.log('Attempting to save question:', {
      questionText,
      instructionId,
      companyId: user.company_id,
      options,
      correctAnswer,
    })

    // Check if tables exist
    try {
      await db.execute('SELECT 1 FROM questions LIMIT 1')
      await db.execute('SELECT 1 FROM answer_choices LIMIT 1')
      console.log('Tables exist, proceeding with insert')
    } catch (tableError) {
      console.error('Table check failed:', tableError)
      return {
        error: `Database tables not found. Please ensure the questions and answer_choices tables exist. Error: ${tableError instanceof Error ? tableError.message : 'Unknown error'}`,
      }
    }

    // Insert the question
    const [questionResult] = await db.execute(
      'INSERT INTO questions (text, instruction_id, question_type, company_id) VALUES (?, ?, ?, ?)',
      [questionText, instructionId, 'MC', user.company_id],
    )

    const questionId = (questionResult as any).insertId
    console.log('Question inserted with ID:', questionId)

    // Insert answer choices
    for (const option of options) {
      const isCorrect = option === correctAnswer
      console.log('Inserting answer choice:', { option, isCorrect, questionId })
      await db.execute(
        'INSERT INTO answer_choices (question_id, text, is_correct) VALUES (?, ?, ?)',
        [questionId, option, isCorrect],
      )
    }

    console.log('Question and answers saved successfully')
    return { success: true, questionId, instructionId }
  } catch (error) {
    console.error('Error saving question:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    })
    return {
      error: `Failed to save question: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

export default function TeachMode() {
  const { instructions } = useLoaderData() as { instructions: InstructionMedium[] }
  const actionData = useActionData<{
    success?: boolean
    error?: string
    questionId?: number
    instructionId?: number
  }>()

  console.log(actionData)

  const [expanded, setExpanded] = React.useState<Record<number, boolean>>({})
  const [savedQuestions, setSavedQuestions] = React.useState<Set<number>>(new Set())

  type NodeState = {
    text: string
    loading: boolean
    saving: boolean
  }

  const [nodeStates, setNodeStates] = React.useState<Record<number, NodeState>>({})

  const setNodeLoading = (id: number, loading: boolean) =>
    setNodeStates(prev => ({
      ...prev,
      [id]: { ...(prev[id] || { text: '', loading: false, saving: false }), loading },
    }))

  const setNodeSaving = (id: number, saving: boolean) =>
    setNodeStates(prev => ({
      ...prev,
      [id]: { ...(prev[id] || { text: '', loading: false, saving: false }), saving },
    }))

  const setNodeText = (id: number, text: string) =>
    setNodeStates(prev => ({
      ...prev,
      [id]: { ...(prev[id] || { text: '', loading: false, saving: false }), text },
    }))

  const appendNodeText = (id: number, delta: string) =>
    setNodeStates(prev => {
      const current = prev[id] || { text: '', loading: false, saving: false }
      return {
        ...prev,
        [id]: { ...current, text: current.text + delta },
      }
    })

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

    const text = nodeStates[node.id]?.text ?? ''
    const loadingMCQ = nodeStates[node.id]?.loading ?? false

    function cleanJSON(value: string) {
      if (value === '') return null
      try {
        return JSON.parse(value)
      } catch (error) {
        return null
      }
    }

    const getInstructionContent = () => {
      const cleanText = node.rich_text
        ?.replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      return {
        title: node.title,
        content: cleanText || node.title,
      }
    }

    const handleGenerate = async (e?: React.MouseEvent) => {
      if (e) e.stopPropagation()
      if (loadingMCQ) return

      setNodeLoading(node.id, true)
      setNodeText(node.id, '')

      const content = getInstructionContent()

      if (!content) {
        alert('No instruction content available to generate questions from')
        setNodeLoading(node.id, false)
        return
      }

      const prompt = `You are a question generator. You MUST return JSON ALWAYS. You will return a JSON object with the following keys: "question", "options", and "answer".

Based on the following educational content, create a multiple choice question:

Title: ${content.title}
Content: ${content.content}

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
          setNodeLoading(node.id, false)
        } else {
          appendNodeText(node.id, event.data)
        }
      })

      sse.addEventListener('error', () => {
        sse.close()
        setNodeLoading(node.id, false)
      })
    }

    const values = cleanJSON(text)
    const isSaving = nodeStates[node.id]?.saving ?? false
    const isSaved = savedQuestions.has(node.id)

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
          <Button
            variant='outline'
            size='sm'
            onClick={() => handleGenerate()}
            style={{ marginLeft: 10 }}
          >
            Generate Question
          </Button>
        </div>
        <div dangerouslySetInnerHTML={{ __html: node.rich_text }} />
        {hasChildren && isOpen && (
          <div>
            {children.map(child => (
              <InstructionNode key={child.id} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
        {loadingMCQ && (
          <div style={{ marginTop: 10, color: '#666' }}>
            <p>Creating a question from this instruction...</p>
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
        {actionData?.error && (
          <div
            style={{
              marginTop: 10,
              padding: 10,
              backgroundColor: '#f8d7da',
              border: '1px solid #f5c6cb',
              borderRadius: 4,
              color: '#721c24',
            }}
          >
            Error: {actionData.error}
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
                {answer}
                {answer === values.answer ? <strong> (correct answer)</strong> : ''}
              </div>
            ))}
            <Form method='post'>
              <input type='hidden' name='questionText' value={values.question} />
              <input type='hidden' name='options' value={values.options} />
              <input type='hidden' name='correctAnswer' value={values.answer} />
              <input type='hidden' name='instructionId' value={node.id.toString()} />
              <Button
                type='submit'
                disabled={isSaving || isSaved}
                style={{
                  marginTop: 15,
                  marginRight: 10,
                  backgroundColor: isSaved ? '#28a745' : undefined,
                  color: isSaved ? 'white' : undefined,
                }}
              >
                {isSaving ? 'Saving...' : isSaved ? 'Saved ✓' : 'Save Question'}
              </Button>
            </Form>
            <Button
              onClick={() => handleGenerate()}
              style={{
                marginTop: 15,
              }}
            >
              Generate New Question
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ padding: 20 }}>
      {roots.map(root => (
        <div key={root.id} style={styles.rootBox}>
          <InstructionNode node={root} depth={0} />
        </div>
      ))}
    </div>
  )
}
