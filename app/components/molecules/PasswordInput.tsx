'use client'

import { EyeIcon, EyeOffIcon } from 'lucide-react'
import * as React from 'react'
import { Button } from '~/components/ui/button'
import { cn } from '~/lib/utils'
import { FormControl, FormItem, FormLabel, FormMessage } from '../ui/form'
import { Input, type InputProps } from '../ui/input'

const PasswordInput = ({
  className,
  field,
  ...props
}: InputProps & { field: object }) => {
  const [showPassword, setShowPassword] = React.useState(false)

  return (
    <FormItem>
      <FormLabel>Password</FormLabel>
      <FormControl>
        <div className='relative'>
          <Input
            name='password'
            type={showPassword ? 'text' : 'password'}
            className={cn('hide-password-toggle pr-10', className)}
            {...field}
            {...props}
          />
          <Button
            type='button'
            variant='ghost'
            size='sm'
            className='absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent z-40'
            onClick={() => setShowPassword(prev => !prev)}
          >
            {showPassword ? (
              <EyeIcon className='h-4 w-4' aria-hidden='true' />
            ) : (
              <EyeOffIcon className='h-4 w-4' aria-hidden='true' />
            )}
            <span className='sr-only'>
              {showPassword ? 'Hide password' : 'Show password'}
            </span>
          </Button>

          <style>{`
					.hide-password-toggle::-ms-reveal,
					.hide-password-toggle::-ms-clear {
						visibility: hidden;
						pointer-events: none;
						display: none;
					}
				`}</style>
        </div>
      </FormControl>
      <FormMessage />
    </FormItem>
  )
}
PasswordInput.displayName = 'PasswordInput'

export { PasswordInput }
