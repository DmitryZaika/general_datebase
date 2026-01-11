// IMPORTS

import * as React from 'react'
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  redirect,
  useActionData,
  useLoaderData,
  useSubmit,
} from 'react-router'
import { Button } from '~/components/ui/button'
import { db } from '~/db.server'
import { useToast } from '~/hooks/use-toast'
import type { InstructionSlim } from '~/types'
import { getEmployeeUser, type SessionUser } from '~/utils/session.server'
import { selectMany } from '../utils/queryHelpers'

// TYPE DEFINITIONS

interface InstructionMedium extends InstructionSlim {
  parent_id: number
  after_id: number
}

interface Question {
  id: number
  text: string
  instruction_id: number
  question_type: 'MC' | 'TF'
  created_date: string
  updated_date: string
}

interface AnswerChoice {
  id: number
  question_id: number
  text: string
  is_correct: boolean
  created_date: string
  updated_date: string
}

interface AnswerAttempt {
  employee_id: number
  question_id: number
  selected_answer_id: number | null
  is_correct: boolean
}

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
    'SELECT id, title, parent_id, after_id, rich_text from instructions WHERE company_id = ?',
    [companyId],
  )
}

async function getQuestions(companyId: number) {
  return selectMany<Question>(
    db,
    `SELECT id, text, instruction_id, question_type, created_date, updated_date
     FROM questions
     WHERE company_id = ? AND is_visible_to_employees = TRUE AND deleted_at IS NULL
     ORDER BY created_date DESC`,
    [companyId],
  )
}

async function getAnswerChoices(companyId: number) {
  return selectMany<AnswerChoice>(
    db,
    'SELECT id, question_id, text, is_correct, created_date, updated_date FROM answer_choices WHERE question_id IN (SELECT id FROM questions WHERE company_id = ?) AND deleted_at IS NULL ORDER BY question_id, id',
    [companyId],
  )
}

async function getNextAttemptNumber(
  employeeId: number,
  questionId: number,
): Promise<number> {
  try {
    const [rows] = await db.execute(
      'SELECT MAX(attempt_number) as max_attempt FROM answer_attempts WHERE employee_id = ? AND question_id = ? AND deleted_at IS NULL',
      [employeeId, questionId],
    )
    const result = (rows as any)[0]
    return (result?.max_attempt || 0) + 1
  } catch (error) {
    console.error('Error getting next attempt number:', error)
    return 1
  }
}

async function saveAnswerAttempts(
  userId: number,
  attempts: AnswerAttempt[],
): Promise<void> {
  for (const attempt of attempts) {
    const attemptNumber = await getNextAttemptNumber(userId, attempt.question_id)
    await db.execute(
      `INSERT INTO answer_attempts (employee_id, question_id, selected_answer_id, attempt_number, is_correct)
       VALUES (?, ?, ?, ?, ?)`,
      [
        attempt.employee_id,
        attempt.question_id,
        attempt.selected_answer_id,
        attemptNumber,
        attempt.is_correct ? 1 : 0,
      ],
    )
  }
  console.log(`Successfully saved ${attempts.length} answer attempts`)
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

  return { instructions, questions, answerChoices, userId: user.id }
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

  if (intent === 'submit-assessment') {
    const attemptsJson = formData.get('attempts') as string
    try {
      const attempts: AnswerAttempt[] = JSON.parse(attemptsJson)
      console.log('About to save attempts:', attempts)
      await saveAnswerAttempts(user.id, attempts)
      console.log('Returning success from action')
      return { success: true, message: 'Assessment submitted successfully!' }
    } catch (error) {
      console.error('Error saving answer attempts:', error)
      return {
        error: `Failed to save attempts: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  }

  return { error: 'Invalid intent' }
}

// UTILITY FUNCTIONS

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = shuffled[i]
    shuffled[i] = shuffled[j]
    shuffled[j] = temp
  }
  return shuffled
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

// CUSTOM HOOKS

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

  return { expanded, toggleExpand }
}

export function useAssessmentState(
  questions: Question[],
  answerChoicesByQuestion: Map<number, AnswerChoice[]>,
  userId: number,
  submit: any,
) {
  const [isAssessmentStarted, setIsAssessmentStarted] = React.useState(false)
  const [shuffledQuestions, setShuffledQuestions] = React.useState<Question[]>([])
  const [shuffledChoicesByQuestion, setShuffledChoicesByQuestion] = React.useState<
    Record<number, AnswerChoice[]>
  >({})
  const [selectedAnswers, setSelectedAnswers] = React.useState<
    Record<number, { text: string; answerId: number }>
  >({})
  const [isSubmitted, setIsSubmitted] = React.useState(false)
  const [score, setScore] = React.useState(0)

  const startAssessment = React.useCallback(() => {
    const shuffledQs = shuffleArray(questions)
    const shuffledChoices: Record<number, AnswerChoice[]> = {}
    shuffledQs.forEach(q => {
      const originalChoices = answerChoicesByQuestion.get(q.id) || []
      shuffledChoices[q.id] = shuffleArray(originalChoices)
    })
    setShuffledQuestions(shuffledQs)
    setShuffledChoicesByQuestion(shuffledChoices)
    setSelectedAnswers({})
    setIsSubmitted(false)
    setIsAssessmentStarted(true)
  }, [questions, answerChoicesByQuestion])

  const handleAnswerSelect = React.useCallback(
    (questionId: number, answerText: string, answerId: number) => {
      if (isSubmitted) return
      setSelectedAnswers(prev => ({
        ...prev,
        [questionId]: { text: answerText, answerId },
      }))
    },
    [isSubmitted],
  )

  const getCorrectAnswer = React.useCallback(
    (questionId: number): string | null => {
      const choices = answerChoicesByQuestion.get(questionId) || []
      const correctChoice = choices.find(choice => choice.is_correct)
      return correctChoice?.text || null
    },
    [answerChoicesByQuestion],
  )

  const isAnswerCorrect = React.useCallback(
    (questionId: number): boolean => {
      const selectedAnswer = selectedAnswers[questionId]?.text
      const correctAnswer = getCorrectAnswer(questionId)
      return selectedAnswer === correctAnswer
    },
    [selectedAnswers, getCorrectAnswer],
  )

  const submitAssessment = React.useCallback(() => {
    const unanswered = shuffledQuestions.length - Object.keys(selectedAnswers).length
    if (unanswered > 0) {
      const confirmed = window.confirm(
        `You have ${unanswered} unanswered question${unanswered === 1 ? '' : 's'}.\n\nClick OK to submit anyway, or Cancel to return to the assessment.`,
      )
      if (!confirmed) return
    }

    // Calculate score
    let correctCount = 0
    shuffledQuestions.forEach(q => {
      const selected = selectedAnswers[q.id]?.text
      const correct = getCorrectAnswer(q.id)
      if (selected === correct) correctCount++
    })
    setScore(Math.round((correctCount / shuffledQuestions.length) * 100))
    setIsSubmitted(true)

    // Prepare answer attempts for database - include ALL questions, even unanswered ones
    const attempts: AnswerAttempt[] = shuffledQuestions.map(q => {
      const selectedAnswer = selectedAnswers[q.id]
      return {
        employee_id: userId,
        question_id: q.id,
        selected_answer_id: selectedAnswer ? selectedAnswer.answerId : null,
        is_correct: selectedAnswer ? isAnswerCorrect(q.id) : false,
      }
    })

    console.log('Submitting attempts (including unanswered):', attempts)

    // Submit to server
    const formData = new FormData()
    formData.append('intent', 'submit-assessment')
    formData.append('attempts', JSON.stringify(attempts))
    submit(formData, { method: 'post' })
  }, [
    shuffledQuestions,
    selectedAnswers,
    getCorrectAnswer,
    isAnswerCorrect,
    userId,
    submit,
  ])

  return {
    isAssessmentStarted,
    shuffledQuestions,
    shuffledChoicesByQuestion,
    selectedAnswers,
    isSubmitted,
    score,
    startAssessment,
    handleAnswerSelect,
    submitAssessment,
    getCorrectAnswer,
    isAnswerCorrect,
  }
}

function useActionToast(actionData: any, toast: any) {
  const lastRef = React.useRef(null)

  React.useEffect(() => {
    if (!actionData) return
    if (actionData === lastRef.current) return
    lastRef.current = actionData

    console.log('Action data received:', actionData)

    if (actionData?.success) {
      console.log('Showing success toast')
      toast({
        title: 'Success',
        description: actionData?.message || 'Assessment submitted successfully!',
        variant: 'success',
      })
    } else if (actionData?.error) {
      console.log('Showing error toast')
      toast({ title: 'Error', description: actionData.error, variant: 'destructive' })
    }
  }, [actionData, toast])
}

// UI COMPONENTS

interface InstructionNodeProps {
  node: InstructionMedium
  depth: number
  childrenOf: (id: number | null) => InstructionMedium[]
  expanded: Record<number, boolean>
  toggleExpand: (id: number) => void
}

const InstructionNode: React.FC<InstructionNodeProps> = ({
  node,
  depth,
  childrenOf,
  expanded,
  toggleExpand,
}) => {
  const children = childrenOf(node.id)
  const hasChildren = children.length > 0
  const isOpen = expanded[node.id] ?? false

  return (
    <div style={styles.item(depth)}>
      <div style={styles.titleRow} onClick={() => toggleExpand(node.id)}>
        <span style={styles.arrow}>{isOpen ? '▼' : '▶'}</span>
        <p style={styles.title}>{node.title ?? '(no title)'}</p>
      </div>

      {isOpen && (
        <>
          <div dangerouslySetInnerHTML={{ __html: node.rich_text }} />

          {hasChildren && (
            <div>
              {children.map(child => (
                <InstructionNode
                  key={child.id}
                  node={child}
                  depth={depth + 1}
                  childrenOf={childrenOf}
                  expanded={expanded}
                  toggleExpand={toggleExpand}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

interface QuestionComponentProps {
  question: Question
  index: number
  choices: AnswerChoice[]
  selectedAnswer: { text: string; answerId: number } | undefined
  isSubmitted: boolean
  correctAnswer: string | null
  isCorrect: boolean
  onAnswerSelect: (questionId: number, answerText: string, answerId: number) => void
}

const QuestionComponent: React.FC<QuestionComponentProps> = ({
  question,
  index,
  choices,
  selectedAnswer,
  isSubmitted,
  correctAnswer,
  isCorrect,
  onAnswerSelect,
}) => {
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
      <h3
        style={{ marginBottom: 15, color: '#333' }}
      >{`${index + 1}. ${question.text}`}</h3>

      {choices.map(choice => {
        const isThisCorrect = choice.is_correct
        const isThisSelected = selectedAnswer?.text === choice.text

        return (
          <div key={choice.id} style={{ marginBottom: 10 }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                cursor: isSubmitted ? 'default' : 'pointer',
                padding: 8,
                borderRadius: 4,
                backgroundColor:
                  isSubmitted && isThisCorrect
                    ? '#d4edda'
                    : isSubmitted && isThisSelected && !isThisCorrect
                      ? '#f8d7da'
                      : 'transparent',
                border:
                  isSubmitted && isThisCorrect
                    ? '1px solid #c3e6cb'
                    : isSubmitted && isThisSelected && !isThisCorrect
                      ? '1px solid #f5c6cb'
                      : '1px solid transparent',
                minHeight: '40px',
              }}
              onClick={e => {
                e.preventDefault()
                onAnswerSelect(question.id, choice.text, choice.id)
              }}
            >
              <input
                type='radio'
                name={`question-${question.id}`}
                value={choice.text}
                checked={isThisSelected}
                onChange={() => {}}
                disabled={isSubmitted}
                style={{ marginRight: 10, pointerEvents: 'none' }}
              />
              <span style={{ fontSize: '1rem' }}>{choice.text}</span>
              {isSubmitted && isThisCorrect ? (
                <span
                  style={{ marginLeft: 'auto', color: '#28a745', fontWeight: 'bold' }}
                >
                  ✓ Correct
                </span>
              ) : null}
            </label>
          </div>
        )
      })}

      {isSubmitted && (
        <div
          style={{
            marginTop: 15,
            padding: 10,
            borderRadius: 4,
            backgroundColor: isCorrect ? '#d4edda' : '#f8d7da',
            border: isCorrect ? '1px solid #c3e6cb' : '1px solid #f5c6cb',
            color: isCorrect ? '#155724' : '#721c24',
          }}
        >
          <strong>
            {isCorrect
              ? '✅ Correct!'
              : `❌ Incorrect. The correct answer is: ${correctAnswer}`}
          </strong>
        </div>
      )}
    </div>
  )
}

// MAIN COMPONENT

export default function TeachMode() {
  const { instructions, questions, answerChoices, userId } = useLoaderData() as {
    instructions: InstructionMedium[]
    questions: Question[]
    answerChoices: AnswerChoice[]
    userId: number
  }

  const submit = useSubmit()
  const { toast } = useToast()
  const actionData = useActionData<{ success?: boolean; error?: string }>()

  useActionToast(actionData, toast)

  const [showSidebar, setShowSidebar] = React.useState(false)

  const answerChoicesByQuestion = useAnswerChoicesByQuestion(answerChoices)
  const { childrenOf, roots } = useInstructionTree(instructions)
  const { expanded, toggleExpand } = useExpandedState()

  const {
    isAssessmentStarted,
    shuffledQuestions,
    shuffledChoicesByQuestion,
    selectedAnswers,
    isSubmitted,
    score,
    startAssessment,
    handleAnswerSelect,
    submitAssessment,
    getCorrectAnswer,
    isAnswerCorrect,
  } = useAssessmentState(questions, answerChoicesByQuestion, userId, submit)

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      {/* Main Content Area */}
      <div
        style={{
          padding: 20,
          marginRight: showSidebar ? '600px' : '0',
          transition: 'margin-right 0.3s ease',
        }}
      >
        {/* Toggle Button */}
        <div style={{ marginBottom: 20 }}>
          <Button onClick={() => setShowSidebar(!showSidebar)}>
            {showSidebar ? 'Hide Training Instructions' : 'Show Training Instructions'}
          </Button>
        </div>

        {/* Assessment Section */}
        {questions.length > 0 ? (
          <div>
            <h2
              style={{
                marginBottom: 20,
                color: '#333',
                borderBottom: '2px solid #28a745',
                paddingBottom: 10,
              }}
            >
              Practice Assessment
            </h2>
            <p style={{ marginBottom: 20, color: '#666', fontStyle: 'italic' }}>
              Test your knowledge with these questions based on the training materials.
            </p>
            {!isAssessmentStarted ? (
              <Button onClick={startAssessment}>Start Assessment</Button>
            ) : !isSubmitted ? (
              <>
                {shuffledQuestions.map((question, index) => (
                  <QuestionComponent
                    key={question.id}
                    question={question}
                    index={index}
                    choices={shuffledChoicesByQuestion[question.id] || []}
                    selectedAnswer={selectedAnswers[question.id]}
                    isSubmitted={isSubmitted}
                    correctAnswer={getCorrectAnswer(question.id)}
                    isCorrect={isAnswerCorrect(question.id)}
                    onAnswerSelect={handleAnswerSelect}
                  />
                ))}
                <Button onClick={submitAssessment}>Submit Assessment</Button>
              </>
            ) : (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '20px',
                    marginBottom: 20,
                  }}
                >
                  <h3 style={{ margin: 0, color: '#333' }}>Your Score: {score}%</h3>
                  <Button onClick={startAssessment}>Take Assessment Again</Button>
                </div>
                {shuffledQuestions.map((question, index) => (
                  <QuestionComponent
                    key={question.id}
                    question={question}
                    index={index}
                    choices={shuffledChoicesByQuestion[question.id] || []}
                    selectedAnswer={selectedAnswers[question.id]}
                    isSubmitted={isSubmitted}
                    correctAnswer={getCorrectAnswer(question.id)}
                    isCorrect={isAnswerCorrect(question.id)}
                    onAnswerSelect={handleAnswerSelect}
                  />
                ))}
              </>
            )}
          </div>
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
            <p>
              Questions will appear here once your administrator creates them based on
              the training materials.
            </p>
          </div>
        )}
      </div>

      {/* Sidebar */}
      {showSidebar && (
        <div
          style={{
            position: 'fixed',
            top: '80px',
            right: 0,
            width: '600px',
            height: 'calc(100vh - 80px)',
            backgroundColor: '#fff',
            boxShadow: '-2px 0 10px rgba(0,0,0,0.1)',
            overflowY: 'auto',
            zIndex: 1000,
            transition: 'transform 0.3s ease',
          }}
        >
          {/* Sidebar Header */}
          <div
            style={{
              position: 'sticky',
              top: 0,
              backgroundColor: '#fff',
              borderBottom: '2px solid #007bff',
              padding: '15px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              zIndex: 1,
            }}
          >
            <h2 style={{ margin: 0, color: '#333' }}>Training Instructions</h2>
            <button
              onClick={() => setShowSidebar(false)}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#666',
                lineHeight: 1,
                padding: '0 5px',
              }}
              title='Close sidebar'
            >
              X
            </button>
          </div>

          {/* Sidebar Content */}
          <div style={{ padding: '20px' }}>
            {roots.map(root => (
              <div key={root.id} style={styles.rootBox}>
                <InstructionNode
                  node={root}
                  depth={0}
                  childrenOf={childrenOf}
                  expanded={expanded}
                  toggleExpand={toggleExpand}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
