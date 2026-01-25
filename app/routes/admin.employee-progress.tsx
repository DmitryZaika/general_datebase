// app/routes/admin.employee-progress.tsx
import type { RowDataPacket } from 'mysql2'
import React from 'react'
import { Link, type LoaderFunctionArgs, redirect, useLoaderData } from 'react-router'
import { Button } from '~/components/ui/button'
import { db } from '~/db.server'
import { getEmployeeUser, type User } from '~/utils/session.server'

// ═════════════════════════════════════════════════════════════════════════════
// TYPES
// ═════════════════════════════════════════════════════════════════════════════

interface AnswerAttempt {
  employee_id: number
  attempt_number: number
  question_id: number
  selected_answer_id: number | null
  is_correct: boolean | number | null
  question_text: string
  selected_answer_text: string | null
  correct_answer_text: string
}

interface DbUserRow extends RowDataPacket {
  id: number
  email: string
  name: string | null
  company_id: number
}

interface DbAnswerAttemptRow extends RowDataPacket {
  employee_id: number
  attempt_number: number
  question_id: number
  selected_answer_id: number | null
  is_correct: boolean | number | null
  question_text: string
  selected_answer_text: string | null
  correct_answer_text: string
}

interface ProgressRow {
  attemptNumber: number
  correct: number
  total: number
  scoreFraction: string
  scorePercent: string
  questions: AnswerAttempt[]
}

interface LoaderData {
  admin: User
  users: User[]
  allAttempts: AnswerAttempt[]
}

// ═════════════════════════════════════════════════════════════════════════════
// SERVER: Database Queries
// ═════════════════════════════════════════════════════════════════════════════

async function fetchUsers(companyId: number): Promise<User[]> {
  const [rows] = await db.query<DbUserRow[]>(
    `SELECT id, email, name, company_id FROM users WHERE company_id = ? ORDER BY name, email`,
    [companyId],
  )
  return rows.map(
    (row): User =>
      ({
        id: row.id,
        email: row.email,
        name: row.name,
        phone_number: row.phone_number,
        is_employee: row.is_employee,
        is_admin: row.is_admin,
        is_superuser: row.is_superuser,
        company_id: row.company_id,
      }) as User,
  )
}

async function fetchAnswerAttempts(companyId: number): Promise<AnswerAttempt[]> {
  const [rows] = await db.query<DbAnswerAttemptRow[]>(
    `SELECT
       aa.employee_id,
       aa.attempt_number,
       aa.question_id,
       aa.selected_answer_id,
       aa.is_correct,
       q.text AS question_text,
       sa.text AS selected_answer_text,
       ca.text AS correct_answer_text
     FROM answer_attempts aa
     JOIN questions q ON aa.question_id = q.id
     LEFT JOIN answer_choices sa ON aa.selected_answer_id = sa.id
     JOIN answer_choices ca ON q.id = ca.question_id AND ca.is_correct = 1
     WHERE aa.employee_id IN (SELECT id FROM users WHERE company_id = ?)
       AND aa.deleted_at IS NULL
     ORDER BY aa.employee_id, aa.attempt_number DESC, aa.created_date`,
    [companyId],
  )
  return rows
}

// ═════════════════════════════════════════════════════════════════════════════
// SERVER: Loader
// ═════════════════════════════════════════════════════════════════════════════

export const loader = async ({ request }: LoaderFunctionArgs) => {
  let admin: User
  try {
    admin = await getEmployeeUser(request)
  } catch (error) {
    throw redirect(`/login?error=${error}`)
  }

  const [users, allAttempts] = await Promise.all([
    fetchUsers(admin.company_id),
    fetchAnswerAttempts(admin.company_id),
  ])

  return { admin, users, allAttempts }
}

// ═════════════════════════════════════════════════════════════════════════════
// BUSINESS LOGIC: Progress Computation
// ═════════════════════════════════════════════════════════════════════════════

function groupAttemptsByNumber(attempts: AnswerAttempt[]) {
  const grouped: Record<
    number,
    { correct: number; total: number; questions: AnswerAttempt[] }
  > = {}
  for (const attempt of attempts) {
    const key = attempt.attempt_number
    const existing = grouped[key]
    const bucket = existing ?? { correct: 0, total: 0, questions: [] }
    bucket.total += 1
    if (attempt.is_correct === 1 || attempt.is_correct === true) {
      bucket.correct += 1
    }
    bucket.questions.push(attempt)
    grouped[key] = bucket
  }
  return grouped
}

function calculateScore(correct: number, total: number) {
  const fraction = `${correct}/${total}`
  const percent = total > 0 ? ((correct / total) * 100).toFixed(1) : '0.0'
  return { fraction, percent: `${percent}%` }
}

function createProgressRow(
  attemptNumber: number,
  data: { correct: number; total: number; questions: AnswerAttempt[] },
): ProgressRow {
  const { fraction, percent } = calculateScore(data.correct, data.total)
  return {
    attemptNumber: Number(attemptNumber),
    correct: data.correct,
    total: data.total,
    scoreFraction: fraction,
    scorePercent: percent,
    questions: data.questions || [],
  }
}

function computeUserProgress(
  allAttempts: AnswerAttempt[],
  userId: number,
): ProgressRow[] {
  const userAttempts = allAttempts.filter(a => a.employee_id === userId)
  const grouped = groupAttemptsByNumber(userAttempts)
  const rows = Object.entries(grouped).map(([attempt, data]) =>
    createProgressRow(Number(attempt), data),
  )
  return rows.sort((a, b) => b.attemptNumber - a.attemptNumber)
}

// ═════════════════════════════════════════════════════════════════════════════
// UTILITY: Formatting & Display
// ═════════════════════════════════════════════════════════════════════════════

function formatUserName(user: User): string {
  return user.name ? `${user.name} (${user.email})` : user.email
}

function formatUserDisplayName(user: User): string {
  return user.name || user.email
}

function getCorrectnessIcon(isCorrect: boolean | number | null): string {
  if (isCorrect === 1 || isCorrect === true) return '✅'
  if (isCorrect === 0 || isCorrect === false) return '❌'
  return '⚪'
}

// ═════════════════════════════════════════════════════════════════════════════
// CUSTOM HOOKS
// ═════════════════════════════════════════════════════════════════════════════

function useUserSelection() {
  const [selectedUserId, setSelectedUserId] = React.useState<number | null>(null)
  const [displayedUserId, setDisplayedUserId] = React.useState<number | null>(null)

  const selectUser = (userId: number | null) => {
    setSelectedUserId(userId)
  }

  const displayUser = (userId: number) => {
    setDisplayedUserId(userId)
  }

  return { selectedUserId, displayedUserId, selectUser, displayUser }
}

function useProgressData() {
  const [progressRows, setProgressRows] = React.useState<ProgressRow[]>([])
  const [hasChecked, setHasChecked] = React.useState(false)

  const updateProgress = (rows: ProgressRow[]) => {
    setProgressRows(rows)
    setHasChecked(true)
  }

  const resetProgress = () => {
    setProgressRows([])
    setHasChecked(false)
  }

  return { progressRows, hasChecked, updateProgress, resetProgress }
}

// ═════════════════════════════════════════════════════════════════════════════
// UI COMPONENTS: Layout
// ═════════════════════════════════════════════════════════════════════════════

function PageContainer({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 40, maxWidth: 1000, margin: '0 auto' }}>{children}</div>
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 24,
        background: '#f9f9f9',
        borderRadius: 8,
        border: '1px solid #eee',
        marginBottom: 24,
      }}
    >
      {children}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// UI COMPONENTS: Navigation
// ═════════════════════════════════════════════════════════════════════════════

function BackButton({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      style={{ textDecoration: 'none', display: 'inline-block', marginBottom: 30 }}
    >
      <Button variant='outline' size='sm'>
        Back to {label}
      </Button>
    </Link>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// UI COMPONENTS: Interactive Elements
// ═════════════════════════════════════════════════════════════════════════════

function Collapsible({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)

  return (
    <div style={{ marginBottom: 16 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '12px 16px',
          background: open ? '#e5e7eb' : '#f3f4f6',
          border: '1px solid #d1d5db',
          borderRadius: 6,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '1rem',
        }}
      >
        {title}
        <span style={{ fontSize: '1.2rem' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div style={{ marginTop: 12, padding: '0 16px' }}>{children}</div>}
    </div>
  )
}

function UserSelect({
  users,
  selectedUserId,
  onUserChange,
}: {
  users: User[]
  selectedUserId: number | null
  onUserChange: (userId: number | null) => void
}) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = Number(e.target.value) || null
    onUserChange(id)
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <label
        htmlFor='user-select'
        style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}
      >
        Select Employee:
      </label>
      <select
        id='user-select'
        value={selectedUserId ?? ''}
        onChange={handleChange}
        style={{
          width: '100%',
          padding: 10,
          borderRadius: 6,
          border: '1px solid #ccc',
          fontSize: 16,
        }}
      >
        <option value=''>-- Choose a user --</option>
        {users.map(user => (
          <option key={user.id} value={user.id}>
            {formatUserName(user)}
          </option>
        ))}
      </select>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// UI COMPONENTS: Table Elements
// ═════════════════════════════════════════════════════════════════════════════

function QuestionTableHeader() {
  return (
    <thead>
      <tr style={{ borderBottom: '2px solid #ddd' }}>
        <th
          style={{
            textAlign: 'center',
            padding: '12px 8px',
            width: '80px',
          }}
        >
          Correct
        </th>
        <th style={{ textAlign: 'left', padding: '12px 8px' }}>Question</th>
        <th style={{ textAlign: 'left', padding: '12px 8px' }}>Selected Answer</th>
        <th style={{ textAlign: 'left', padding: '12px 8px' }}>Correct Answer</th>
      </tr>
    </thead>
  )
}

function QuestionTableRow({
  question,
  index,
}: {
  question: AnswerAttempt
  index: number
}) {
  return (
    <tr
      style={{
        borderBottom: '1px solid #eee',
        backgroundColor: index % 2 === 0 ? '#fcfcfc' : 'transparent',
      }}
    >
      <td
        style={{
          textAlign: 'center',
          padding: '12px 8px',
          fontSize: '1.5rem',
        }}
      >
        {getCorrectnessIcon(question.is_correct)}
      </td>
      <td style={{ padding: '12px 8px' }}>
        {question.question_text || 'Question text missing'}
      </td>
      <td style={{ padding: '12px 8px' }}>
        {question.selected_answer_text ? (
          question.selected_answer_text
        ) : (
          <em>No answer provided</em>
        )}
      </td>
      <td style={{ padding: '12px 8px' }}>
        {question.correct_answer_text || 'Correct answer missing'}
      </td>
    </tr>
  )
}

function QuestionTable({ questions }: { questions: AnswerAttempt[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <QuestionTableHeader />
        <tbody>
          {questions.map((q, idx) => (
            <QuestionTableRow key={idx} question={q} index={idx} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// UI COMPONENTS: Progress Display
// ═════════════════════════════════════════════════════════════════════════════

function AttemptCollapsible({ row }: { row: ProgressRow }) {
  return (
    <Collapsible
      title={`Attempt ${row.attemptNumber} — ${row.scoreFraction} (${row.scorePercent})`}
    >
      <QuestionTable questions={row.questions || []} />
    </Collapsible>
  )
}

function ProgressCard({
  user,
  progressRows,
}: {
  user: User
  progressRows: ProgressRow[]
}) {
  return (
    <Card>
      <h2 style={{ marginTop: 0, marginBottom: 16, fontWeight: 600 }}>
        Progress for: <strong>{formatUserDisplayName(user)}</strong>
      </h2>
      {progressRows.map(row => (
        <AttemptCollapsible key={row.attemptNumber} row={row} />
      ))}
    </Card>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// UI COMPONENTS: Empty States
// ═════════════════════════════════════════════════════════════════════════════

function NoAttemptsMessage() {
  return (
    <Card>
      <p>No quiz attempts found for this user.</p>
    </Card>
  )
}

function InitialStateMessage() {
  return (
    <Card>
      <p>Select a user and click "Check User Progress" to view their quiz history.</p>
    </Card>
  )
}

function UserSelectedMessage() {
  return (
    <Card>
      <p>Click "Check User Progress" to load quiz attempts.</p>
    </Card>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// UI COMPONENTS: Main Sections
// ═════════════════════════════════════════════════════════════════════════════

function PageHeader({ adminEmail }: { adminEmail: string }) {
  return (
    <>
      <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: 16 }}>
        Employee Progress
      </h1>
      <p style={{ marginBottom: 30, color: '#555' }}>
        Welcome, <strong>{adminEmail}</strong>! Select a user and click the button
        below.
      </p>
    </>
  )
}

function UserSelectionSection({
  users,
  selectedUserId,
  onUserChange,
  onCheckProgress,
}: {
  users: User[]
  selectedUserId: number | null
  onUserChange: (userId: number | null) => void
  onCheckProgress: () => void
}) {
  return (
    <>
      <UserSelect
        users={users}
        selectedUserId={selectedUserId}
        onUserChange={onUserChange}
      />
      <Button
        onClick={onCheckProgress}
        disabled={!selectedUserId}
        style={{ marginBottom: 30 }}
      >
        Check User Progress
      </Button>
    </>
  )
}

function ProgressDisplaySection({
  users,
  progressRows,
  displayedUserId,
  selectedUserId,
  hasChecked,
}: {
  users: User[]
  progressRows: ProgressRow[]
  displayedUserId: number | null
  selectedUserId: number | null
  hasChecked: boolean
}) {
  const displayedUser = users.find(u => u.id === displayedUserId)

  // Show progress if we have data
  if (progressRows.length > 0 && displayedUser) {
    return <ProgressCard user={displayedUser} progressRows={progressRows} />
  }

  // Show "no attempts" if we checked and found nothing
  if (hasChecked && selectedUserId && progressRows.length === 0) {
    return <NoAttemptsMessage />
  }

  // Show "click button" if user is selected but not checked
  if (selectedUserId && !hasChecked && !progressRows.length) {
    return <UserSelectedMessage />
  }

  // Show initial state if no user selected
  if (!selectedUserId) {
    return <InitialStateMessage />
  }

  return null
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export default function EmployeeProgressPage() {
  const { admin, users, allAttempts } = useLoaderData<LoaderData>()
  const { selectedUserId, displayedUserId, selectUser, displayUser } =
    useUserSelection()
  const { progressRows, hasChecked, updateProgress } = useProgressData()

  const handleCheckProgress = () => {
    if (selectedUserId) {
      const rows = computeUserProgress(allAttempts, selectedUserId)
      updateProgress(rows)
      displayUser(selectedUserId)
    }
  }

  return (
    <PageContainer>
      <PageHeader adminEmail={admin.email} />
      <BackButton to='/admin/teach-mode' label='Teach Mode' />
      <UserSelectionSection
        users={users}
        selectedUserId={selectedUserId}
        onUserChange={selectUser}
        onCheckProgress={handleCheckProgress}
      />
      <ProgressDisplaySection
        users={users}
        progressRows={progressRows}
        displayedUserId={displayedUserId}
        selectedUserId={selectedUserId}
        hasChecked={hasChecked}
      />
    </PageContainer>
  )
}
