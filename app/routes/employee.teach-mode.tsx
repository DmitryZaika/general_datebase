import * as React from 'react'
import { type LoaderFunctionArgs, redirect, useLoaderData } from 'react-router'
import { Button } from '~/components/ui/button'
import { db } from '~/db.server'
import type { InstructionSlim } from '~/types'
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
    `SELECT id, text, instruction_id, question_type, created_date, updated_date
     FROM questions
     WHERE company_id = ? AND is_visible_to_employees = TRUE AND deleted_at IS NULL
     ORDER BY created_date DESC`,
    [user.company_id],
  )

  // Fetch answer choices for all questions
  const answerChoices = await selectMany<AnswerChoice>(
    db,
    'SELECT id, question_id, text, is_correct, created_date, updated_date FROM answer_choices WHERE question_id IN (SELECT id FROM questions WHERE company_id = ?) AND deleted_at IS NULL ORDER BY question_id, id',
    [user.company_id],
  )

  return { instructions, questions, answerChoices }
}

export default function TeachMode() {
  const { instructions, questions, answerChoices } = useLoaderData() as {
    instructions: InstructionMedium[]
    questions: Question[]
    answerChoices: AnswerChoice[]
  }

  const [expanded, setExpanded] = React.useState<Record<number, boolean>>({})
  const [isAssessmentStarted, setIsAssessmentStarted] = React.useState(false)
  const [shuffledQuestions, setShuffledQuestions] = React.useState<Question[]>([])
  const [shuffledChoicesByQuestion, setShuffledChoicesByQuestion] = React.useState<
    Record<number, AnswerChoice[]>
  >({})
  const [selectedAnswers, setSelectedAnswers] = React.useState<Record<number, string>>(
    {},
  )
  const [isSubmitted, setIsSubmitted] = React.useState(false)
  const [score, setScore] = React.useState(0)

  // Group answer choices by question ID
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

  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const temp = shuffled[i]
      shuffled[i] = shuffled[j]
      shuffled[j] = temp
    }
    return shuffled
  }

  const startAssessment = () => {
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
  }

  const handleAnswerSelect = (questionId: number, answerText: string) => {
    if (isSubmitted) return
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: answerText,
    }))
  }

  const submitAssessment = () => {
    const unanswered = shuffledQuestions.length - Object.keys(selectedAnswers).length
    if (unanswered > 0) {
      const confirmed = window.confirm(
        `You have ${unanswered} unanswered question${unanswered === 1 ? '' : 's'}.\n\nClick OK to submit anyway, or Cancel to return to the assessment.`,
      )
      if (!confirmed) return
    }
    let correctCount = 0
    shuffledQuestions.forEach(q => {
      const selected = selectedAnswers[q.id]
      const correct = getCorrectAnswer(q.id)
      if (selected === correct) correctCount++
    })
    setScore(Math.round((correctCount / shuffledQuestions.length) * 100))
    setIsSubmitted(true)
  }

  const getCorrectAnswer = (questionId: number): string | null => {
    const choices = answerChoicesByQuestion.get(questionId) || []
    const correctChoice = choices.find(choice => choice.is_correct)
    return correctChoice?.text || null
  }

  const isAnswerCorrect = (questionId: number): boolean => {
    const selectedAnswer = selectedAnswers[questionId]
    const correctAnswer = getCorrectAnswer(questionId)
    return selectedAnswer === correctAnswer
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

  const QuestionComponent: React.FC<{ question: Question; index: number }> = ({
    question,
    index,
  }) => {
    const choices = shuffledChoicesByQuestion[question.id] || []
    const selectedAnswer = selectedAnswers[question.id]
    const isCorrect = isAnswerCorrect(question.id)
    const correctAnswer = getCorrectAnswer(question.id)

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
          const isThisSelected = selectedAnswer === choice.text

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
                  handleAnswerSelect(question.id, choice.text)
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

  return (
    <div style={{ padding: 20 }}>
      {/* Instructions Section */}
      <div style={{ marginBottom: 40 }}>
        <h2
          style={{
            marginBottom: 20,
            color: '#333',
            borderBottom: '2px solid #007bff',
            paddingBottom: 10,
          }}
        >
          Training Instructions
        </h2>
        {roots.map(root => (
          <div key={root.id} style={styles.rootBox}>
            <InstructionNode node={root} depth={0} />
          </div>
        ))}
      </div>

      {/* Assessment Section */}
      {questions.length > 0 && (
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
            Test your knowledge with these questions based on the training materials
            above.
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
                />
              ))}
            </>
          )}
        </div>
      )}

      {questions.length === 0 && (
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
            Questions will appear here once your administrator creates them based on the
            training materials.
          </p>
        </div>
      )}
    </div>
  )
}
