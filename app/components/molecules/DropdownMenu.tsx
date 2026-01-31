import type { ReactNode } from 'react'
import { Button } from '~/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'

export interface DropdownOption {
  label: ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
  icon?: ReactNode
}

export interface DropdownSection {
  title?: string
  options: DropdownOption[]
}

export interface CustomDropdownMenuProps {
  /**
   * Custom trigger element. If not provided, a default Button will be used.
   * If provided, make sure it accepts refs (forwardRef) if used with asChild (default behavior of DropdownMenuTrigger).
   */
  trigger?: ReactNode
  /**
   * Label for the default button trigger if `trigger` is not provided.
   */
  triggerLabel?: string
  /**
   * Grouped options with optional titles.
   */
  sections?: DropdownSection[]
  /**
   * Flat list of options. If provided alongside sections, it will be added as another group.
   */
  options?: DropdownOption[]
  align?: 'start' | 'center' | 'end'
  contentClassName?: string
}

export const CustomDropdownMenu = ({
  trigger,
  triggerLabel = 'Open',
  sections = [],
  options = [],
  align = 'start',
  contentClassName,
}: CustomDropdownMenuProps) => {
  const allSections: DropdownSection[] = [...sections]
  if (options.length > 0) {
    allSections.push({ options })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger ? trigger : <Button variant='outline'>{triggerLabel}</Button>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className={contentClassName}>
        {allSections.map((section, index) => (
          <div key={index}>
            {index > 0 && <DropdownMenuSeparator />}
            <DropdownMenuGroup>
              {section.title && <DropdownMenuLabel>{section.title}</DropdownMenuLabel>}
              {section.options.map((option, optIndex) => (
                <DropdownMenuItem
                  key={optIndex}
                  onClick={option.onClick}
                  disabled={option.disabled}
                  className={option.className}
                >
                  {option.icon && (
                    <span className='mr-2 h-4 w-4 flex items-center justify-center'>
                      {option.icon}
                    </span>
                  )}
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
