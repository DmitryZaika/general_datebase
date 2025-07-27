import { MoreHorizontal } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Button } from '~/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'

interface IProps {
  actions: Record<string, string>
  asBlank?: boolean
  label?: string
}

export const ActionDropdown = ({
  actions,
  asBlank = false,
  label = 'Actions',
}: IProps) => {
  const [open, setOpen] = useState(false)

  return (
    <div className='flex justify-end pr-5'>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant='ghost'
            className='h-8 w-8 p-0'
            disabled={Object.keys(actions).length === 0}
            onClick={e => {
              e.stopPropagation()
              setOpen(true)
            }}
          >
            <span className='sr-only'>Open menu</span>
            <MoreHorizontal className='h-4 w-4' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' onClick={e => e.stopPropagation()}>
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          {Object.entries(actions).map(([action, link]) => (
            <DropdownMenuItem key={action} asChild onClick={e => e.stopPropagation()}>
              <Link
                to={link}
                target={asBlank ? '_blank' : '_self'}
                onClick={e => e.stopPropagation()}
              >
                {action.charAt(0).toUpperCase() + action.slice(1)}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
