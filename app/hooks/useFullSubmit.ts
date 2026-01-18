import { useEffect, useRef } from 'react'
import type { FieldValues, UseFormReturn } from 'react-hook-form'
import { useNavigation, useSubmit } from 'react-router'
import { useAuthenticityToken } from 'remix-utils/csrf/react'

export function useFullSubmit<TFieldValues extends FieldValues = FieldValues>(
  form: UseFormReturn<TFieldValues>,
  action: undefined | string = undefined,
  method: 'POST' | 'DELETE' = 'POST',
  handleData?: (data: TFieldValues) => void,
  navigateOnSubmit: boolean = false,
) {
  const submit = useSubmit()
  const navigation = useNavigation()
  const token = useAuthenticityToken()

  const isSubmittingRef = useRef(false)

  console.log('navigation.state', navigation.state)

  useEffect(() => {
    if (navigation.state === 'idle') {
      isSubmittingRef.current = false
    }
  }, [navigation.state])

  const cleanData = (data: object) => {
    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => [
        key,
        handleData
          ? handleData(value === undefined ? null : value)
          : value === undefined
            ? null
            : value,
      ]),
    )
  }

  const fullSubmit = form.handleSubmit(
    data => {
      if (navigation.state !== 'idle' || isSubmittingRef.current) {
        return
      }

      isSubmittingRef.current = true

      const sanitizedData = cleanData(data)
      sanitizedData.csrf = token

      const answer =  submit(sanitizedData, {
        method: method,
        action: action,
        encType: 'application/x-www-form-urlencoded',
        navigate: navigateOnSubmit,
      })
      return answer
    },
    () => {
      form.trigger()
    },
  )

  return fullSubmit
}
