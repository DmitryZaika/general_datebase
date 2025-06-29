import { cn } from '~/lib/utils'

interface IProps extends React.HTMLProps<HTMLSpanElement> {
  children: React.ReactNode
  isSelected?: boolean
  variant?: 'default' | 'blue'
  disabled?: boolean
}

export const LinkSpan = ({
  children,
  className,
  isSelected,
  variant = 'default',
  disabled = false,
  onClick,
  ...props
}: IProps) => (
  <span
    className={cn(
      'transition-colors duration-300',
      !disabled ? 'cursor-pointer' : 'opacity-60',
      variant === 'default' && [
        'text-zinc-900 dark:text-zinc-50',
        !disabled && 'hover:text-blue-500 underline',
        isSelected && 'text-blue-500 hover:text-blue-500',
      ],
      variant === 'blue' &&
        (!disabled ? 'text-blue-500 hover:text-blue-600' : 'text-blue-400'),
      className,
    )}
    aria-current={isSelected ? 'page' : undefined}
    onClick={disabled ? undefined : onClick}
    {...props}
  >
    {children}
  </span>
)
