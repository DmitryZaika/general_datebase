import { useEffect } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { ClientOnly } from 'remix-utils/client-only'
import { Button } from '~/components/ui/button'
import { FormItem, FormLabel, FormMessage } from '~/components/ui/form'

interface RHFField {
  onChange: (value: unknown) => void
  value: unknown
}

export interface SigRef {
  isEmpty: () => boolean
  getCanvas: () => { toDataURL: (format: string) => string }
  fromDataURL: (
    base64String: string,
    options: { width: number; height: number; classname?: string },
  ) => void
  clear: () => void
}

interface Props {
  field: RHFField
  name?: string
  sigRef: React.RefObject<SigRef | null>
}

export const SignatureInput = ({ field, name = 'Signature', sigRef }: Props) => {
  const handleEnd = () => {
    if (sigRef.current?.isEmpty()) {
      field.onChange('')
      return
    }
    const url = sigRef.current?.getCanvas().toDataURL('image/png')
    field.onChange(url)
  }

  const clear = () => {
    sigRef.current?.clear()
    field.onChange('')
  }

  useEffect(() => {
    if (field.value && sigRef.current?.isEmpty() && typeof field.value === 'string') {
      sigRef.current?.fromDataURL(field.value, { width: 500, height: 150 })
    }
  }, [field.value, sigRef.current])
  return (
    <FormItem>
      <FormLabel>{name}</FormLabel>
      <div className='border rounded-md h-[150px] w-full flex items-center justify-center bg-white'>
        <ClientOnly fallback={<span className='text-sm text-gray-400'>Loading…</span>}>
          {() => (
            <SignatureCanvas
              ref={sigRef}
              penColor='black'
              backgroundColor='transparent'
              canvasProps={{ width: 500, height: 150, className: 'w-full' }}
              onEnd={handleEnd}
            />
          )}
        </ClientOnly>
      </div>
      <Button
        type='button'
        size='sm'
        variant='outline'
        className='mt-1'
        onClick={clear}
      >
        Clear
      </Button>
      <FormMessage />
    </FormItem>
  )
}
