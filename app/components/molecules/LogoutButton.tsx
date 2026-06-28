import { Link, useNavigation } from 'react-router'
import type { ButtonProps } from '~/components/ui/button'
import { LoadingButton } from './LoadingButton'

export function LogoutButton({
  children = 'Logout',
  variant,
  ...props
}: Omit<ButtonProps, 'loading'>) {
  const navigation = useNavigation()
  const loading =
    navigation.state !== 'idle' && navigation.location?.pathname === '/logout'

  return (
    <Link to='/logout'>
      <LoadingButton loading={loading} type='button' variant={variant} {...props}>
        {children}
      </LoadingButton>
    </Link>
  )
}
