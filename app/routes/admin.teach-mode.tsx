// IMPORTS

import * as React from 'react'
import {
  type ActionFunctionArgs,
  Form,
  type LoaderFunctionArgs,
  redirect,
  type SubmitFunction,
  useActionData,
  useLoaderData,
  useRevalidator,
  useSubmit,
} from 'react-router'
import { Button } from '~/components/ui/button'
import { Switch } from '~/components/ui/switch'
import { db } from '~/db.server'
import { useToast } from '~/hooks/use-toast'
import type { InstructionSlim } from '~/types'
import { DONE_KEY } from '~/utils/constants'
import { getEmployeeUser, type SessionUser } from '~/utils/session.server'
import { selectMany } from '../utils/queryHelpers'

// TYPE DEFINITIONS + CONSTANTS

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
  deleted_at: string | null
  created_date: string
  updated_date: string
}

interface AnswerChoice {
  id: number
  question_id: number
  text: string
  is_correct: boolean
  deleted_at: string | null
  created_date: string
  updated_date: string
}

interface NodeState {
  text: string
  loading: boolean
  saving: boolean
}

type NodeStates = Record<number, NodeState>

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

// DATABASE HELPER FUNCTIONS

async function getInstructions(companyId: number) {
  return selectMany<InstructionMedium>(
    db,
    'SELECT id, title, parent_id, after_id, rich_text FROM instructions WHERE company_id = ?',
    [companyId],
  )
}

async function getQuestions(companyId: number) {
  return selectMany<Question>(
    db,
    `SELECT id, text, instruction_id, question_type, company_id, created_by_user_id, is_visible_to_employees, deleted_at, created_date, updated_date
     FROM questions
     WHERE company_id = ? AND deleted_at IS NULL
     ORDER BY created_date DESC`,
    [companyId],
  )
}

async function getAnswerChoices(companyId: number) {
  return selectMany<AnswerChoice>(
    db,
    `SELECT id, question_id, text, is_correct, deleted_at, created_date, updated_date
     FROM answer_choices
     WHERE question_id IN (SELECT id FROM questions WHERE company_id = ?)
       AND deleted_at IS NULL
     ORDER BY question_id, id`,
    [companyId],
  )
}

// LOADER AND ACTION

export const loader = async ({ request }: LoaderFunctionArgs) => {
  let user: SessionUser

  try {
    user = await getEmployeeUser(request)
  } catch (error) {
    return redirect(`/login?error=${error}`)
  }

  const [instructions, questions, answerChoices] = await Promise.all([
    getInstructions(user.company_id),
    getQuestions(user.company_id),
    getAnswerChoices(user.company_id),
  ])

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

  switch (intent) {
    case 'toggle-visibility':
      return toggleVisibility(user, formData)
    case 'create-question':
      return createQuestion(user, formData)
    case 'edit-question':
      return editQuestion(user, formData)
    case 'delete-question':
      return deleteQuestion(user, formData)
    default:
      // Handle the default save question case
      return saveGeneratedQuestion(user, formData)
  }
}

// CRUD FUNCTIONS

async function toggleVisibility(user: SessionUser, formData: FormData) {
  const questionId = parseInt(formData.get('questionId') as string)
  const visible = formData.get('visible') === 'true'

  if (isNaN(questionId)) return { error: 'Invalid question ID' }

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
}

async function createQuestion(user: SessionUser, formData: FormData) {
  const questionText = formData.get('questionText') as string
  const options = JSON.parse(formData.get('options') as string)
  const correctAnswerId = parseInt(formData.get('correctAnswerId') as string)

  if (!questionText || !options || options.length === 0 || isNaN(correctAnswerId)) {
    return { error: 'Missing required question data for create' }
  }

  const validOptions = options.filter((c: any) => !c.is_deleted && c.text.trim() !== '')
  if (validOptions.length < 2)
    return { error: 'At least two non-empty answer choices are required' }
  if (!validOptions.some((c: any) => c.id === correctAnswerId))
    return { error: 'Please select a valid correct answer' }

  try {
    const [questionResult] = await db.execute(
      'INSERT INTO questions (text, instruction_id, question_type, company_id) VALUES (?, NULL, ?, ?)',
      [questionText, 'MC', user.company_id],
    )
    const questionId = (questionResult as any).insertId

    for (const option of validOptions) {
      await db.execute(
        'INSERT INTO answer_choices (question_id, text, is_correct) VALUES (?, ?, ?)',
        [questionId, option.text, option.id === correctAnswerId ? 1 : 0],
      )
    }

    return { success: true, questionId }
  } catch (error) {
    console.error('Error creating question:', error)
    return {
      error: `Failed to create question: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

async function editQuestion(user: SessionUser, formData: FormData) {
  const questionId = parseInt(formData.get('questionId') as string)
  const questionText = formData.get('questionText') as string
  const options = JSON.parse(formData.get('options') as string)
  const correctAnswerId = parseInt(formData.get('correctAnswerId') as string)

  if (!questionText || !options || options.length === 0 || isNaN(correctAnswerId)) {
    return { error: 'Missing required question data for edit' }
  }

  const validOptions = options.filter(
    (opt: any) => !opt.is_deleted && opt.text.trim() !== '',
  )
  if (validOptions.length < 2)
    return { error: 'At least two non-empty answer choices are required' }
  if (!validOptions.some((opt: any) => opt.id === correctAnswerId))
    return { error: 'Please select a valid correct answer' }

  try {
    const [questionCheck] = await db.execute(
      'SELECT id FROM questions WHERE id = ? AND company_id = ?',
      [questionId, user.company_id],
    )

    if (!questionCheck || (questionCheck as any).length === 0) {
      return {
        error: 'Invalid question ID or question does not belong to your company',
      }
    }

    await db.execute(
      'UPDATE questions SET text = ?, updated_date = CURRENT_TIMESTAMP WHERE id = ? AND company_id = ?',
      [questionText, questionId, user.company_id],
    )

    for (const option of options) {
      if (option.is_deleted) {
        if (option.id && option.id > 0) {
          await db.execute(
            'UPDATE answer_choices SET deleted_at = CURRENT_TIMESTAMP, updated_date = CURRENT_TIMESTAMP WHERE id = ? AND question_id = ?',
            [option.id, questionId],
          )
        }
        continue
      }

      if (option.id && option.id > 0) {
        await db.execute(
          'UPDATE answer_choices SET text = ?, is_correct = ?, updated_date = CURRENT_TIMESTAMP WHERE id = ? AND question_id = ?',
          [option.text, option.id === correctAnswerId ? 1 : 0, option.id, questionId],
        )
      } else {
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
}

async function deleteQuestion(user: SessionUser, formData: FormData) {
  const questionId = parseInt(formData.get('questionId') as string)
  if (isNaN(questionId)) return { error: 'Invalid question ID' }

  try {
    const [questionCheck] = await db.execute(
      'SELECT id FROM questions WHERE id = ? AND company_id = ?',
      [questionId, user.company_id],
    )
    if (!questionCheck || (questionCheck as any).length === 0) {
      return {
        error: 'Invalid question ID or question does not belong to your company',
      }
    }

    await db.execute(
      'UPDATE questions SET deleted_at = CURRENT_TIMESTAMP, updated_date = CURRENT_TIMESTAMP WHERE id = ? AND company_id = ?',
      [questionId, user.company_id],
    )

    return { success: true, questionId }
  } catch (error) {
    console.error('Error deleting question:', error)
    return {
      error: `Failed to delete question: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

async function saveGeneratedQuestion(user: SessionUser, formData: FormData) {
  const questionText = formData.get('questionText') as string
  const optionsString = formData.get('options') as string
  const options = optionsString.split(',').map(s => s.trim())
  const correctAnswer = formData.get('correctAnswer') as string
  const instructionId = parseInt(formData.get('instructionId') as string)

  if (
    !questionText ||
    !options ||
    options.length < 2 ||
    !correctAnswer ||
    !instructionId
  ) {
    return { error: 'Missing required question data or insufficient answer choices' }
  }

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

    const [questionResult] = await db.execute(
      'INSERT INTO questions (text, instruction_id, question_type, company_id) VALUES (?, ?, ?, ?)',
      [questionText, instructionId, 'MC', user.company_id],
    )

    const questionId = (questionResult as any).insertId
    for (const option of options) {
      const isCorrect = option === correctAnswer
      await db.execute(
        'INSERT INTO answer_choices (question_id, text, is_correct) VALUES (?, ?, ?)',
        [questionId, option, isCorrect ? 1 : 0],
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

// UTILITY FUNCTIONS

function safeParseJSON(value: string) {
  try {
    return value ? JSON.parse(value) : null
  } catch {
    return null
  }
}

export function orderSiblings(list: InstructionMedium[]): InstructionMedium[] {
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
}

const parentKey = (pid: number | null) => (pid && pid !== 0 ? pid : null)

function buildQuestionPrompt(title: string, content: string) {
  const prompt = `You are a creative and varied question generator. You MUST return ONLY valid JSON. Never wrap it in code blocks or explanations.
 Return a JSON object with exactly these keys: "question", "options", and "answer".
 Based on the following educational content, create a multiple choice question:
 Title: ${title}
 Content: ${content}
 Guidelines for diversity:
 - Vary the style of the question each time (scenario-based, cause/effect, "what could happen if...", "which of the following statements...", etc.)
 - Avoid reusing the same phrasing or structure as previous questions
 - The options should be realistic and not obviously wrong — make them sound believable
 - Only ONE option should be correct
 - The question should feel natural and not formulaic
 - Provide at least 4 options, but more are allowed if appropriate
 Return ONLY valid JSON in this format, with no extra text:
 {
   "question": "Your question here?",
   "options": ["Option A", "Option B", "Option C", "Option D", ...],
   "answer": "The correct option exactly as written in options"
 }
 Now generate a **unique and varied** multiple choice question based on the content above.`

  return prompt
}

//QUESTION MANAGEMENT CUSTOM HOOKS

function useManualQuestion(
  submit: SubmitFunction,
  setShowManualEntry: React.Dispatch<React.SetStateAction<boolean>>,
) {
  const [editedQuestionText, setEditedQuestionText] = React.useState('')
  const [editedChoices, setEditedChoices] = React.useState<
    { id: number | null; text: string; is_correct: boolean; is_deleted?: boolean }[]
  >([])
  const [correctAnswerId, setCorrectAnswerId] = React.useState<number | null>(null)

  const handleQuestionTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditedQuestionText(e.target.value)
  }

  const handleChoiceTextChange = (id: number | null, value: string) => {
    setEditedChoices(prev =>
      prev.map(choice => (choice.id === id ? { ...choice, text: value } : choice)),
    )
  }

  const handleCorrectAnswerChange = (id: number | null) => setCorrectAnswerId(id)

  const handleAddChoice = () => {
    const newId = Math.min(...editedChoices.map(c => c.id || 0), 0) - 1
    setEditedChoices(prev => [...prev, { id: newId, text: '', is_correct: false }])
  }

  const handleDeleteChoice = (id: number | null) => {
    if (editedChoices.filter(c => !c.is_deleted).length <= 2) {
      alert('At least two answer choices are required.')
      return
    }
    setEditedChoices(prev =>
      prev.map(choice => (choice.id === id ? { ...choice, is_deleted: true } : choice)),
    )
    if (correctAnswerId === id) setCorrectAnswerId(null)
  }

  const handleSave = () => {
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
    formData.append('intent', 'create-question')
    formData.append('questionText', editedQuestionText)
    formData.append('options', JSON.stringify(editedChoices))
    formData.append('correctAnswerId', (correctAnswerId ?? '').toString())
    submit(formData, { method: 'post' })

    setShowManualEntry(false)
  }

  const handleCancel = () => setShowManualEntry(false)

  return {
    editedQuestionText,
    editedChoices,
    correctAnswerId,
    handleQuestionTextChange,
    handleChoiceTextChange,
    handleCorrectAnswerChange,
    handleAddChoice,
    handleDeleteChoice,
    handleSave,
    handleCancel,
  }
}

function useEditableQuestion(
  question: Question,
  choices: AnswerChoice[],
  submit: SubmitFunction,
) {
  const [editingQuestions, setEditingQuestions] = React.useState<Set<number>>(new Set())
  const [editedQuestionText, setEditedQuestionText] = React.useState(question.text)
  const [editedChoices, setEditedChoices] = React.useState(
    choices.map(choice => ({
      id: choice.id,
      text: choice.text,
      is_correct: choice.is_correct,
    })),
  )
  const [correctAnswerId, setCorrectAnswerId] = React.useState<number | null>(
    choices.find(c => c.is_correct)?.id || null,
  )

  React.useEffect(() => {
    if (!editingQuestions.has(question.id)) {
      setEditedQuestionText(question.text)
      setEditedChoices(
        choices.map(choice => ({
          id: choice.id,
          text: choice.text,
          is_correct: choice.is_correct,
        })),
      )
      setCorrectAnswerId(choices.find(c => c.is_correct)?.id || null)
    }
  }, [question, choices, editingQuestions])

  const isEditing = editingQuestions.has(question.id)

  const toggleEditing = () => {
    setEditingQuestions(prev => {
      const newSet = new Set(prev)
      newSet.has(question.id) ? newSet.delete(question.id) : newSet.add(question.id)
      return newSet
    })
  }

  const handleQuestionTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditedQuestionText(e.target.value)
  }

  const handleChoiceTextChange = (id: number | null, value: string) => {
    setEditedChoices(prev =>
      prev.map(choice => (choice.id === id ? { ...choice, text: value } : choice)),
    )
  }

  const handleCorrectAnswerChange = (id: number | null) => setCorrectAnswerId(id)

  const handleAddChoice = () => {
    const newId = Math.min(...editedChoices.map(c => c.id || 0), 0) - 1
    setEditedChoices(prev => [...prev, { id: newId, text: '', is_correct: false }])
  }

  const handleDeleteChoice = (id: number | null) => {
    if (editedChoices.filter(c => !c.is_deleted).length <= 2) {
      alert('At least two answer choices are required.')
      return
    }
    setEditedChoices(prev =>
      prev.map(c => (c.id === id ? { ...c, is_deleted: true } : c)),
    )
    if (correctAnswerId === id) setCorrectAnswerId(null)
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
  }

  const handleDiscardChanges = () => {
    setEditingQuestions(prev => {
      const newSet = new Set(prev)
      newSet.delete(question.id)
      return newSet
    })
  }

  const handleDeleteQuestion = () => {
    if (!window.confirm('Are you sure? This action cannot be undone.')) return
    const formData = new FormData()
    formData.append('intent', 'delete-question')
    formData.append('questionId', question.id.toString())
    submit(formData, { method: 'post' })
  }

  const handleVisibilityToggle = (checked: boolean) => {
    const formData = new FormData()
    formData.append('intent', 'toggle-visibility')
    formData.append('questionId', question.id.toString())
    formData.append('visible', checked.toString())
    submit(formData, { method: 'post' })
  }

  return {
    editedQuestionText,
    editedChoices,
    correctAnswerId,
    isEditing,
    toggleEditing,
    handleQuestionTextChange,
    handleChoiceTextChange,
    handleCorrectAnswerChange,
    handleAddChoice,
    handleDeleteChoice,
    handleSaveChanges,
    handleDiscardChanges,
    handleDeleteQuestion,
    handleVisibilityToggle,
  }
}

export function useInstructionNode({
  node,
  nodeStates,
  setNodeLoading,
  setNodeText,
  appendNodeText,
  setNodeSaving,
  setSavedQuestions,
  setRejectedQuestions,
  savedQuestions,
  rejectedQuestions,
  submit,
}: {
  node: InstructionMedium
  nodeStates: NodeStates
  setNodeLoading: (id: number, loading: boolean) => void
  setNodeText: (id: number, text: string) => void
  appendNodeText: (id: number, delta: string) => void
  setNodeSaving: (id: number, saving: boolean) => void
  setSavedQuestions: React.Dispatch<React.SetStateAction<Set<number>>>
  setRejectedQuestions: React.Dispatch<React.SetStateAction<Set<number>>>
  savedQuestions: Set<number>
  rejectedQuestions: Set<number>
  submit: SubmitFunction
}) {
  const { getInstructionContent } = useInstructionContent(node)
  const { handleGenerate } = useQuestionGenerator({
    node,
    getInstructionContent,
    setNodeLoading,
    setNodeText,
    appendNodeText,
    setSavedQuestions,
    setRejectedQuestions,
  })
  const { handleSaveQuestion, handleRejectQuestion, isSaved } = useQuestionPersistence({
    node,
    setNodeSaving,
    setRejectedQuestions,
    savedQuestions,
    submit,
  })

  const text = nodeStates[node.id]?.text ?? ''
  const values = safeParseJSON(text)
  const loadingMCQ = nodeStates[node.id]?.loading ?? false
  const isSaving = nodeStates[node.id]?.saving ?? false
  const isRejected = rejectedQuestions.has(node.id)

  return {
    text,
    values,
    loadingMCQ,
    isSaving,
    isSaved,
    isRejected,
    handleGenerate,
    handleSaveQuestion,
    handleRejectQuestion,
  }
}

export function useQuestionGenerator({
  node,
  getInstructionContent,
  setNodeLoading,
  setNodeText,
  appendNodeText,
  setSavedQuestions,
  setRejectedQuestions,
}: {
  node: InstructionMedium
  getInstructionContent: () => { title: string; content: string }
  setNodeLoading: (id: number, loading: boolean) => void
  setNodeText: (id: number, text: string) => void
  appendNodeText: (id: number, delta: string) => void
  setSavedQuestions: React.Dispatch<React.SetStateAction<Set<number>>>
  setRejectedQuestions: React.Dispatch<React.SetStateAction<Set<number>>>
}) {
  const handleGenerate = React.useCallback(
    (e?: React.MouseEvent) => {
      if (e) e.stopPropagation()

      // Reset saved/rejected state for this node
      setSavedQuestions(prev => {
        const s = new Set(prev)
        s.delete(node.id)
        return s
      })
      setRejectedQuestions(prev => {
        const s = new Set(prev)
        s.delete(node.id)
        return s
      })

      setNodeLoading(node.id, true)
      setNodeText(node.id, '') // clear previous text

      const content = getInstructionContent()
      if (!content) {
        alert('No instruction content available.')
        setNodeLoading(node.id, false)
        return
      }

      const prompt = encodeURIComponent(
        buildQuestionPrompt(content.title, content.content),
      )
      const sse = new EventSource(`/api/chat?query=${prompt}&isNew=true`)

      sse.addEventListener('message', event => {
        if (event.data === DONE_KEY) {
          sse.close()
          setNodeLoading(node.id, false)
        } else {
          appendNodeText(node.id, event.data)
        }
      })

      sse.addEventListener('error', () => {
        console.error('SSE connection error for node', node.id)
        sse.close()
        setNodeLoading(node.id, false)
      })
    },
    [
      node.id,
      getInstructionContent,
      setNodeLoading,
      setNodeText,
      appendNodeText,
      setSavedQuestions,
      setRejectedQuestions,
    ],
  )

  return { handleGenerate }
}

export function useQuestionPersistence({
  node,
  setNodeSaving,
  setRejectedQuestions,
  savedQuestions,
  submit,
}: {
  node: InstructionMedium
  setNodeSaving: (id: number, saving: boolean) => void
  setRejectedQuestions: React.Dispatch<React.SetStateAction<Set<number>>>
  savedQuestions: Set<number>
  submit: SubmitFunction
}) {
  const isSaved = savedQuestions.has(node.id)

  const handleSaveQuestion = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (isSaved) return

      setNodeSaving(node.id, true)
      const form = e.target as HTMLFormElement
      const formData = new FormData(form)
      submit(formData, { method: 'post' })

      setTimeout(() => setNodeSaving(node.id, false), 500)
    },
    [isSaved, node.id, setNodeSaving, submit],
  )

  const handleRejectQuestion = React.useCallback(() => {
    setRejectedQuestions(prev => new Set(prev).add(node.id))
  }, [node.id, setRejectedQuestions])

  return { handleSaveQuestion, handleRejectQuestion, isSaved }
}

//NODE + TREE MANAGEMENT CUSTOM HOOKS

export function useNodeStates(initialStates: NodeStates = {}) {
  const [nodeStates, setNodeStates] = React.useState<NodeStates>(initialStates)

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

  return { nodeStates, setNodeLoading, setNodeSaving, setNodeText, appendNodeText }
}

export function useInstructionTree(instructions: InstructionMedium[]) {
  const siblingsByParent = useSiblingsByParent(instructions)

  const childrenOf = React.useCallback(
    (pid: number | null) => orderSiblings(siblingsByParent.get(parentKey(pid)) ?? []),
    [siblingsByParent],
  )

  const roots = childrenOf(null)

  return { childrenOf, roots }
}

export function useSiblingsByParent(instructions: InstructionMedium[]) {
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

  return siblingsByParent
}

export function useExpandedState(initialState: Record<number, boolean> = {}) {
  const [expanded, setExpanded] = React.useState(initialState)

  const toggleExpand = React.useCallback((id: number) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const isExpanded = React.useCallback((id: number) => !!expanded[id], [expanded])

  return { expanded, toggleExpand, isExpanded, setExpanded }
}

export function useInstructionContent(node: InstructionMedium) {
  const getInstructionContent = React.useCallback(() => {
    const cleanText = node.rich_text
      ?.replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    return { title: node.title, content: cleanText || node.title }
  }, [node])

  return { getInstructionContent }
}

export function useAnswerChoicesByQuestion(answerChoices: AnswerChoice[]) {
  return React.useMemo(() => {
    const grouped = new Map<number, AnswerChoice[]>()
    for (const choice of answerChoices) {
      const existing = grouped.get(choice.question_id) || []
      grouped.set(choice.question_id, [...existing, choice])
    }
    return grouped
  }, [answerChoices])
}

//TOASTS + EFFECTS CUSTOM HOOKS

function useActionToast(actionData: any, revalidator: any, toast: any) {
  const lastRef = React.useRef(null)

  React.useEffect(() => {
    if (actionData === lastRef.current) return
    lastRef.current = actionData

    if (actionData?.success) {
      toast({ title: 'Success', description: 'Question saved!', variant: 'success' })
      if (revalidator.state === 'idle') revalidator.revalidate()
    } else if (actionData?.error) {
      toast({ title: 'Error', description: actionData.error, variant: 'destructive' })
    }
  }, [actionData, revalidator, toast])
}

function useUpdateSavedQuestions(
  actionData: any,
  setSavedQuestions: React.Dispatch<React.SetStateAction<Set<number>>>,
) {
  React.useEffect(() => {
    if (actionData?.success && actionData?.instructionId) {
      setSavedQuestions(prev => new Set(prev).add(actionData.instructionId))
    }
  }, [actionData, setSavedQuestions])
}

// UI COMPONENTS

const ManualQuestionEntry = ({
  submit,
  setShowManualEntry,
}: {
  submit: SubmitFunction
  setShowManualEntry: React.Dispatch<React.SetStateAction<boolean>>
}) => {
  const {
    editedQuestionText,
    editedChoices,
    correctAnswerId,
    handleQuestionTextChange,
    handleChoiceTextChange,
    handleCorrectAnswerChange,
    handleAddChoice,
    handleDeleteChoice,
    handleSave,
    handleCancel,
  } = useManualQuestion(submit, setShowManualEntry)

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
      <h3 style={{ marginBottom: 15, color: '#333' }}>Manual Question Entry</h3>
      <input
        type='text'
        value={editedQuestionText}
        onChange={handleQuestionTextChange}
        placeholder='Enter question text'
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
                onChange={e => handleChoiceTextChange(choice.id, e.target.value)}
                placeholder='Enter answer choice'
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
                name='correct-answer-manual'
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
        <Button onClick={handleSave}>Save Question</Button>
        <Button variant='outline' onClick={handleCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

export const AdminQuestionComponent = ({
  question,
  choices,
  submit,
}: {
  question: Question
  choices: AnswerChoice[]
  submit: SubmitFunction
}) => {
  const {
    editedQuestionText,
    editedChoices,
    correctAnswerId,
    isEditing,
    toggleEditing,
    handleQuestionTextChange,
    handleChoiceTextChange,
    handleCorrectAnswerChange,
    handleAddChoice,
    handleDeleteChoice,
    handleSaveChanges,
    handleDiscardChanges,
    handleDeleteQuestion,
    handleVisibilityToggle,
  } = useEditableQuestion(question, choices, submit)

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
            c =>
              !c.is_deleted && (
                <div
                  key={c.id || `new-${Math.abs(c.id || 0)}`}
                  style={{ marginBottom: 10, display: 'flex', alignItems: 'center' }}
                >
                  <input
                    type='text'
                    value={c.text}
                    onChange={e => handleChoiceTextChange(c.id, e.target.value)}
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
                    name={`correct-${question.id}`}
                    checked={correctAnswerId === c.id}
                    onChange={() => handleCorrectAnswerChange(c.id)}
                  />
                  <span style={{ marginLeft: 5, marginRight: 10 }}>Correct</span>
                  <Button
                    variant='destructive'
                    size='sm'
                    onClick={() => handleDeleteChoice(c.id)}
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
              Close Editor
            </Button>
            <Button variant='destructive' onClick={handleDeleteQuestion}>
              Delete Question
            </Button>
          </div>
        </>
      ) : (
        <>
          <h3 style={{ marginBottom: 15, color: '#333' }}>{question.text}</h3>
          {choices
            .filter(c => c.text && c.text.trim() !== '')
            .map(c => {
              const isCorrect = Boolean(c.is_correct)
              return (
                <div key={c.id} style={{ marginBottom: 8 }}>
                  {c.text}
                  {isCorrect && <strong> (correct answer)</strong>}
                </div>
              )
            })}

          <div
            style={{ display: 'flex', alignItems: 'center', marginTop: 15, gap: 10 }}
          >
            <Button variant='outline' onClick={toggleEditing}>
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
  const { toast } = useToast()

  useActionToast(actionData, revalidator, toast)

  const [savedQuestions, setSavedQuestions] = React.useState<Set<number>>(new Set())
  const [rejectedQuestions, setRejectedQuestions] = React.useState<Set<number>>(
    new Set(),
  )
  const [showManualEntry, setShowManualEntry] = React.useState(false)

  useUpdateSavedQuestions(actionData, setSavedQuestions)
  const { nodeStates, setNodeLoading, setNodeSaving, setNodeText, appendNodeText } =
    useNodeStates()

  const answerChoicesByQuestion = useAnswerChoicesByQuestion(answerChoices)
  const { childrenOf, roots } = useInstructionTree(instructions)
  const { expanded, toggleExpand } = useExpandedState()

  const InstructionNode: React.FC<{ node: InstructionMedium; depth: number }> = ({
    node,
    depth,
  }) => {
    const children = childrenOf(node.id)
    const hasChildren = children.length > 0
    const isOpen = expanded[node.id] ?? false

    const {
      text,
      values,
      loadingMCQ,
      isSaving,
      isSaved,
      isRejected,
      handleGenerate,
      handleSaveQuestion,
      handleRejectQuestion,
    } = useInstructionNode({
      node,
      setNodeLoading,
      setNodeText,
      appendNodeText,
      setNodeSaving,
      setSavedQuestions,
      setRejectedQuestions,
      nodeStates,
      submit,
      savedQuestions,
      rejectedQuestions,
    })

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
            onClick={e => {
              e.stopPropagation()
              handleGenerate()
            }}
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
        {values !== null && (
          <div
            className='mt-5 p-5'
            style={{
              border: '2px solid #888',
              borderRadius: 8,
              marginTop: 20,
              position: 'relative',
              display: isRejected ? 'none' : 'block',
            }}
          >
            <button
              onClick={handleRejectQuestion}
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                background: 'transparent',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#888',
                lineHeight: 1,
                padding: '0 5px',
              }}
              title='Reject question'
            >
              ×
            </button>
            <h2 style={{ marginBottom: 15 }}>{values.question}</h2>

            {values.options?.map((answer: string, index: number) => {
              const isCorrect = answer === values.answer
              return (
                <div key={index} style={{ marginBottom: 8 }}>
                  {answer}
                  {isCorrect && <strong> (correct answer)</strong>}
                </div>
              )
            })}

            <Form method='post' onSubmit={handleSaveQuestion}>
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
                  cursor: isSaved ? 'not-allowed' : 'pointer',
                  opacity: isSaved ? 0.9 : 1,
                }}
              >
                {isSaving
                  ? 'Saving...'
                  : isSaved
                    ? 'Question Saved ✓'
                    : 'Save Question'}
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
      <div style={{ marginTop: 20, marginBottom: 20 }}>
        <Button onClick={() => setShowManualEntry(!showManualEntry)}>
          {showManualEntry ? 'Cancel Manual Entry' : 'Add Manual Question'}
        </Button>
        {showManualEntry && (
          <ManualQuestionEntry
            submit={submit}
            setShowManualEntry={setShowManualEntry}
          />
        )}
      </div>
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
        {questions.length > 0 ? (
          questions.map(question => (
            <AdminQuestionComponent
              key={question.id}
              question={question}
              choices={answerChoicesByQuestion.get(question.id) || []}
              submit={submit}
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
