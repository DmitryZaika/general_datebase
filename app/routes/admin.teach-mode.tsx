import * as React from 'react'
import {
  type ActionFunctionArgs,
  Form,
  type LoaderFunctionArgs,
  redirect,
  useActionData,
  useLoaderData,
  useRevalidator,
  useSubmit,
} from 'react-router'
import { Button } from '~/components/ui/button'
import { Switch } from '~/components/ui/switch'
import { db } from '~/db.server'
import type { InstructionSlim } from '~/types'
import { DONE_KEY } from '~/utils/constants'
import { getEmployeeUser, type SessionUser } from '~/utils/session.server'
import { selectMany } from '../utils/queryHelpers'

interface InstructionMedium extends InstructionSlim {
  parent_id: number
  after_id: number
}

interface Question {
  id: number
  text: string
  instruction_id: number
  question_type: 'MC' | 'TF'
  company_id: number
  created_by_user_id: number | null
  is_visible_to_employees: boolean
  is_deleted: boolean
  created_date: string
  updated_date: string
}

interface AnswerChoice {
  id: number
  question_id: number
  text: string
  is_correct: boolean
  is_deleted: boolean
  created_date: string
  updated_date: string
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

  const questions = await selectMany<Question>(
    db,
    `SELECT id, text, instruction_id, question_type, company_id, created_by_user_id, is_visible_to_employees, is_deleted, created_date, updated_date
     FROM questions
     WHERE company_id = ? AND is_deleted = FALSE
     ORDER BY created_date DESC`,
    [user.company_id],
  )

  const answerChoices = await selectMany<AnswerChoice>(
    db,
    'SELECT id, question_id, text, is_correct, is_deleted, created_date, updated_date FROM answer_choices WHERE question_id IN (SELECT id FROM questions WHERE company_id = ?) AND is_deleted = FALSE ORDER BY question_id, id',
    [user.company_id],
  )

  return { instructions, questions, answerChoices }
}

export const action = async ({ request }: ActionFunctionArgs) => {
  let user: SessionUser
  try {
    user = await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  const formData = await request.formData()
  const intent = formData.get('intent') as string | null

  if (intent === 'toggle-visibility') {
    const questionId = parseInt(formData.get('questionId') as string)
    const visible = formData.get('visible') === 'true'

    if (isNaN(questionId)) {
      return { error: 'Invalid question ID' }
    }

    try {
      await db.execute(
        'UPDATE questions SET is_visible_to_employees = ? WHERE id = ? AND company_id = ?',
        [visible ? 1 : 0, questionId, user.company_id],
      )
      return { success: true }
    } catch (error) {
      console.error('Error toggling visibility:', error)
      return { error: 'Failed to toggle visibility' }
    }
  } else if (intent === 'edit-question') {
    const questionId = parseInt(formData.get('questionId') as string)
    const questionText = formData.get('questionText') as string
    const options = JSON.parse(formData.get('options') as string) as {
      id: number | null
      text: string
      is_correct: boolean
      is_deleted?: boolean
    }[]
    const correctAnswerId = parseInt(formData.get('correctAnswerId') as string)

    if (!questionText || !options || options.length === 0 || isNaN(correctAnswerId)) {
      return { error: 'Missing required question data for edit' }
    }

    const validOptions = options.filter(
      opt => !opt.is_deleted && opt.text.trim() !== '',
    )
    if (validOptions.length < 2) {
      return { error: 'At least two non-empty answer choices are required' }
    }

    if (!correctAnswerId || !validOptions.some(opt => opt.id === correctAnswerId)) {
      return { error: 'Please select a valid correct answer' }
    }

    try {
      // Validate question exists
      const [questionCheck] = await db.execute(
        'SELECT id FROM questions WHERE id = ? AND company_id = ?',
        [questionId, user.company_id],
      )

      if (!questionCheck || (questionCheck as any).length === 0) {
        return {
          error: 'Invalid question ID or question does not belong to your company',
        }
      }

      // Update question text
      await db.execute(
        'UPDATE questions SET text = ?, updated_date = CURRENT_TIMESTAMP WHERE id = ? AND company_id = ?',
        [questionText, questionId, user.company_id],
      )

      // Handle answer choices
      for (const option of options) {
        if (option.is_deleted) {
          if (option.id && option.id > 0) {
            await db.execute(
              'UPDATE answer_choices SET is_deleted = TRUE, updated_date = CURRENT_TIMESTAMP WHERE id = ? AND question_id = ?',
              [option.id, questionId],
            )
          }
          continue
        }

        if (option.id && option.id > 0) {
          // Update existing answer choice
          await db.execute(
            'UPDATE answer_choices SET text = ?, is_correct = ?, updated_date = CURRENT_TIMESTAMP WHERE id = ? AND question_id = ?',
            [option.text, option.id === correctAnswerId ? 1 : 0, option.id, questionId],
          )
        } else {
          // Insert new answer choice
          await db.execute(
            'INSERT INTO answer_choices (question_id, text, is_correct) VALUES (?, ?, ?)',
            [questionId, option.text, option.id === correctAnswerId ? 1 : 0],
          )
        }
      }

      return { success: true, questionId }
    } catch (error) {
      console.error('Error editing question:', error)
      return {
        error: `Failed to edit question: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  } else {
    // Original save question logic
    const questionText = formData.get('questionText') as string
    const optionsString = formData.get('options') as string
    const options = optionsString.split(',').map(s => s.trim())
    const correctAnswer = formData.get('correctAnswer') as string
    const instructionId = parseInt(formData.get('instructionId') as string)

    if (!questionText || !options || !correctAnswer || !instructionId) {
      return { error: 'Missing required question data' }
    }

    try {
      const [instructionCheck] = await db.execute(
        'SELECT id FROM instructions WHERE id = ? AND company_id = ?',
        [instructionId, user.company_id],
      )

      if (!instructionCheck || (instructionCheck as any).length === 0) {
        return {
          error:
            'Invalid instruction ID or instruction does not belong to your company',
        }
      }

      const [questionResult] = await db.execute(
        'INSERT INTO questions (text, instruction_id, question_type, company_id) VALUES (?, ?, ?, ?)',
        [questionText, instructionId, 'MC', user.company_id],
      )

      const questionId = (questionResult as any).insertId
      for (const option of options) {
        const isCorrect = option === correctAnswer
        await db.execute(
          'INSERT INTO answer_choices (question_id, text, is_correct) VALUES (?, ?, ?)',
          [questionId, option, isCorrect],
        )
      }

      return { success: true, questionId, instructionId }
    } catch (error) {
      console.error('Error saving question:', error)
      return {
        error: `Failed to save question: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  }
}

export default function TeachMode() {
  const { instructions, questions, answerChoices } = useLoaderData() as {
    instructions: InstructionMedium[]
    questions: Question[]
    answerChoices: AnswerChoice[]
  }
  const actionData = useActionData<{
    success?: boolean
    error?: string
    questionId?: number
    instructionId?: number
  }>()
  const submit = useSubmit()
  const revalidator = useRevalidator()

  React.useEffect(() => {
    if (actionData?.success && revalidator.state === 'idle') {
      revalidator.revalidate()
    }
  }, [actionData, revalidator])

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

  const answerChoicesByQuestion = React.useMemo(() => {
    const grouped = new Map<number, AnswerChoice[]>()
    for (const choice of answerChoices) {
      const existing = grouped.get(choice.question_id) || []
      grouped.set(choice.question_id, [...existing, choice])
    }
    return grouped
  }, [answerChoices])

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

      const prompt = `You are a creative and varied question generator. You MUST return ONLY valid JSON. Never wrap it in code blocks or explanations.

Return a JSON object with exactly these keys: "question", "options", and "answer".

Based on the following educational content, create a multiple choice question:

Title: ${content.title}
Content: ${content.content}

Guidelines for diversity:
- Vary the style of the question each time (scenario-based, cause/effect, "what could happen if...", "which of the following statements...", etc.)
- Avoid reusing the same phrasing or structure as previous questions
- The options should be realistic and not obviously wrong — make them sound believable
- Only ONE option should be correct
- The question should feel natural and not formulaic

Return ONLY valid JSON in this format, with no extra text:
{
  "question": "Your question here?",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "answer": "The correct option exactly as written in options"
}

Now generate a **unique and varied** multiple choice question based on the content above.`

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

  const AdminQuestionComponent: React.FC<{
    question: Question
    choices: AnswerChoice[]
  }> = ({ question, choices }) => {
    const [isEditing, setIsEditing] = React.useState(false)
    const [editedQuestionText, setEditedQuestionText] = React.useState(question.text)
    const [editedChoices, setEditedChoices] = React.useState<
      { id: number | null; text: string; is_correct: boolean; is_deleted?: boolean }[]
    >(
      choices.map(choice => ({
        id: choice.id,
        text: choice.text,
        is_correct: choice.is_correct,
      })),
    )
    const [correctAnswerId, setCorrectAnswerId] = React.useState<number | null>(
      choices.find(choice => choice.is_correct)?.id || null,
    )

    React.useEffect(() => {
      if (!isEditing) {
        setEditedQuestionText(question.text)
        setEditedChoices(
          choices.map(choice => ({
            id: choice.id,
            text: choice.text,
            is_correct: choice.is_correct,
          })),
        )
        setCorrectAnswerId(choices.find(choice => choice.is_correct)?.id || null)
      }
    }, [question.text, choices, isEditing])

    const handleEditToggle = () => {
      setIsEditing(!isEditing)
    }

    const handleQuestionTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setEditedQuestionText(e.target.value)
    }

    const handleChoiceTextChange = (
      id: number | null,
      e: React.ChangeEvent<HTMLInputElement>,
    ) => {
      setEditedChoices(prev =>
        prev.map(choice =>
          choice.id === id ? { ...choice, text: e.target.value } : choice,
        ),
      )
    }

    const handleCorrectAnswerChange = (id: number | null) => {
      setCorrectAnswerId(id)
    }

    const handleAddChoice = () => {
      const newId = Math.min(...editedChoices.map(c => c.id || 0), 0) - 1
      setEditedChoices(prev => [...prev, { id: newId, text: '', is_correct: false }])
    }

    const handleDeleteChoice = (id: number | null) => {
      if (editedChoices.filter(c => !c.is_deleted).length <= 2) {
        alert('Cannot delete: At least two answer choices are required.')
        return
      }
      setEditedChoices(prev =>
        prev.map(choice =>
          choice.id === id ? { ...choice, is_deleted: true } : choice,
        ),
      )
      if (correctAnswerId === id) {
        setCorrectAnswerId(null)
      }
    }

    const handleSaveChanges = () => {
      const validChoices = editedChoices.filter(
        c => !c.is_deleted && c.text.trim() !== '',
      )
      if (validChoices.length < 2) {
        alert('At least two non-empty answer choices are required.')
        return
      }
      if (!correctAnswerId || !validChoices.some(c => c.id === correctAnswerId)) {
        alert('Please select a correct answer.')
        return
      }
      const formData = new FormData()
      formData.append('intent', 'edit-question')
      formData.append('questionId', question.id.toString())
      formData.append('questionText', editedQuestionText)
      formData.append('options', JSON.stringify(editedChoices))
      formData.append('correctAnswerId', (correctAnswerId ?? '').toString())
      submit(formData, { method: 'post' })
      setIsEditing(false)
    }

    const handleDiscardChanges = () => {
      setIsEditing(false)
    }

    const handleVisibilityToggle = (checked: boolean) => {
      const formData = new FormData()
      formData.append('intent', 'toggle-visibility')
      formData.append('questionId', question.id.toString())
      formData.append('visible', checked.toString())
      submit(formData, { method: 'post' })
    }

    return (
      <div
        style={{
          border: '2px solid #888',
          borderRadius: 8,
          padding: 20,
          marginBottom: 20,
          backgroundColor: '#fff',
        }}
      >
        {isEditing ? (
          <>
            <input
              type='text'
              value={editedQuestionText}
              onChange={handleQuestionTextChange}
              style={{
                width: '100%',
                padding: 8,
                marginBottom: 15,
                borderRadius: 4,
                border: '1px solid #ccc',
              }}
            />
            {editedChoices.map(
              choice =>
                !choice.is_deleted && (
                  <div
                    key={choice.id || `new-${Math.abs(choice.id || 0)}`}
                    style={{ marginBottom: 10, display: 'flex', alignItems: 'center' }}
                  >
                    <input
                      type='text'
                      value={choice.text}
                      onChange={e => handleChoiceTextChange(choice.id, e)}
                      style={{
                        flex: 1,
                        padding: 8,
                        borderRadius: 4,
                        border: '1px solid #ccc',
                        marginRight: 10,
                      }}
                    />
                    <input
                      type='radio'
                      name={`correct-answer-${question.id}`}
                      checked={correctAnswerId === choice.id}
                      onChange={() => handleCorrectAnswerChange(choice.id)}
                    />
                    <span style={{ marginLeft: 5, marginRight: 10 }}>Correct</span>
                    <Button
                      variant='destructive'
                      size='sm'
                      onClick={() => handleDeleteChoice(choice.id)}
                    >
                      Delete
                    </Button>
                  </div>
                ),
            )}
            <Button
              variant='outline'
              size='sm'
              onClick={handleAddChoice}
              style={{ marginBottom: 15 }}
            >
              Add Answer Choice
            </Button>
            <div style={{ display: 'flex', gap: 10, marginTop: 15 }}>
              <Button onClick={handleSaveChanges}>Save Changes</Button>
              <Button variant='outline' onClick={handleDiscardChanges}>
                Discard Changes
              </Button>
            </div>
          </>
        ) : (
          <>
            <h3 style={{ marginBottom: 15, color: '#333' }}>{question.text}</h3>
            {choices.map(choice => (
              <div key={choice.id} style={{ marginBottom: 8 }}>
                {choice.text}
                {choice.is_correct ? <strong> (correct answer)</strong> : ''}
              </div>
            ))}
            <div
              style={{ display: 'flex', alignItems: 'center', marginTop: 15, gap: 10 }}
            >
              <Button variant='outline' onClick={handleEditToggle}>
                Edit Question
              </Button>
              <label style={{ marginRight: 10, color: '#333' }}>
                Visible to employees:
              </label>
              <Switch
                checked={question.is_visible_to_employees}
                onCheckedChange={handleVisibilityToggle}
              />
            </div>
          </>
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
      <div style={{ marginTop: 40 }}>
        <h2
          style={{
            marginBottom: 20,
            color: '#333',
            borderBottom: '2px solid #28a745',
            paddingBottom: 10,
          }}
        >
          All Questions ({questions.length})
        </h2>
        {actionData?.error && (
          <div
            style={{
              marginBottom: 20,
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
        {questions.length > 0 ? (
          questions.map(question => (
            <AdminQuestionComponent
              key={question.id}
              question={question}
              choices={answerChoicesByQuestion.get(question.id) || []}
            />
          ))
        ) : (
          <div
            style={{
              textAlign: 'center',
              padding: 40,
              color: '#666',
              backgroundColor: '#f8f9fa',
              borderRadius: 8,
              border: '1px solid #dee2e6',
            }}
          >
            <h3 style={{ marginBottom: 10 }}>No Questions Available</h3>
            <p>No questions have been added yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
