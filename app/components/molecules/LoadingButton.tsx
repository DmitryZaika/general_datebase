import { Spinner } from '../atoms/Spinner'
import { Button, type ButtonProps } from '../ui/button'

interface LoadingButtonProps extends ButtonProps {
  loading: boolean
}

export function LoadingButton({ loading, type = 'submit', children, ...props }: LoadingButtonProps) {
  return (
    <Button {...props} type={type}>
      {loading ? <Spinner size={20} /> : children}
    </Button>
  )
}
