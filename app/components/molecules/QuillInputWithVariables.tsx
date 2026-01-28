import { useCallback, useState } from 'react'
import { QuillEditorWithVariables } from '../atoms/QuillEditorWithVariables'
import { FormControl, FormItem, FormLabel, FormMessage } from '../ui/form'

interface QuillInputWithVariablesProps {
  name: string
  field: {
    onChange: (value: string) => void
    value: string
    name: string
  }
  className?: string
}

const INFO_TEXT = {
  predefined:
    'Use "Insert Variable" button to add variables like Full name, Company name, etc. These cannot be edited after insertion.',
  custom:
    'manually for custom placeholders that employees will replace manually.',
} as const

export function QuillInputWithVariables({
  name,
  field,
  className,
}: QuillInputWithVariablesProps) {
  const [validationError, setValidationError] = useState<string>()

  const handleValidationChange = useCallback(
    (isValid: boolean, error?: string) => {
      setValidationError(isValid ? undefined : error)
    },
    [],
  )

  return (
    <FormItem className={className}>
      <FormControl>
        <QuillEditorWithVariables
          value={field.value}
          onChange={field.onChange}
          onValidationChange={handleValidationChange}
          renderInsertButton={button => (
            <div className='flex items-center justify-between mb-2'>
              <FormLabel className='mb-0'>{name}</FormLabel>
              {button}
            </div>
          )}
        />
      </FormControl>

      <div className='mt-2 p-3 text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded-md'>
        <p>
          <strong>Predefined variables</strong> (auto-filled for employee):{' '}
          {INFO_TEXT.predefined}
        </p>
        <p className='mt-1'>
          <strong>Custom variables</strong>: Type{' '}
          <code className='bg-blue-100 px-1 rounded'>{'{{Your Text}}'}</code>{' '}
          {INFO_TEXT.custom}
        </p>
      </div>

      {validationError && (
        <p className='mt-1 text-sm text-red-600'>{validationError}</p>
      )}

      <FormMessage />
    </FormItem>
  )
}
