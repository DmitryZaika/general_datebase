import type { ButtonHTMLAttributes } from 'react'
import { Spinner } from '../atoms/Spinner'
import { Button } from '../ui/button'

interface LoadingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading: boolean
}

export function LoadingButton({ loading, type = 'submit', children, ...props }: LoadingButtonProps) {
  return (
    <Button {...props} type={type}>
      {loading ? <Spinner size={20} /> : children}
    </Button>
  )
}
