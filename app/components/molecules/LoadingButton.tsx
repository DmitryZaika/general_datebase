import type { ButtonHTMLAttributes } from 'react'
import { Spinner } from '../atoms/Spinner'
import { Button } from '../ui/button'

interface LoadingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading: boolean
}

export function LoadingButton({ loading, children, ...props }: LoadingButtonProps) {
  return (
    <Button {...props} type='submit'>
      {loading ? <Spinner size={20} /> : children}
    </Button>
  )
}
