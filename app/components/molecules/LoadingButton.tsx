import { useState, useEffect } from 'react'
import { Spinner } from '../atoms/Spinner'
import { Button, type ButtonProps } from '../ui/button'

interface LoadingButtonProps extends ButtonProps {
  loading: boolean
}

export function LoadingButton({
  loading,
  type = 'submit',
  children,
  onClick,
  ...props
}: LoadingButtonProps) {
  const [clicked, setClicked] = useState(false)

  useEffect(() => {
    setClicked(false)
  }, [loading])

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Delay setting clicked state to ensure the click event propagates
    // and triggers form submission (if type='submit') before the button becomes disabled.
    setTimeout(() => {
      setClicked(true)
    }, 0)
    onClick?.(e)
  }

  const isActuallyLoading = loading || clicked

  return (
    <Button
      {...props}
      type={type}
      disabled={isActuallyLoading || props.disabled}
      onClick={handleClick}
    >
      {isActuallyLoading ? <Spinner size={20} /> : children}
    </Button>
  )
}
