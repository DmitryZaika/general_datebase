import { cn } from '~/lib/utils'

const BOLD_LABEL_PATTERN = /^(-\s*)(.+?)(:)(.*)$/

function NoteContentLine({ line }: { line: string }) {
  const match = line.match(BOLD_LABEL_PATTERN)
  if (!match) return line

  const [, bullet = '', label, colon, rest] = match
  return (
    <>
      {bullet}
      <strong>
        {label}
        {colon}
      </strong>
      {rest}
    </>
  )
}

export function NoteContent({
  content,
  className,
}: {
  content: string
  className?: string
}) {
  const lines = content.split('\n')

  return (
    <p
      className={cn(
        'mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-800',
        className,
      )}
    >
      {lines.map((line, index) => (
        <span key={index}>
          {index > 0 ? '\n' : null}
          <NoteContentLine line={line} />
        </span>
      ))}
    </p>
  )
}
