/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { Suspense } from 'react'
import { Button } from '~/components/ui/button'
import { FormItem, FormLabel, FormMessage } from '~/components/ui/form'

interface RHFField {
  onChange: (value: unknown) => void
  value: unknown
}

export interface SigRef {
  isEmpty: () => boolean
  getTrimmedCanvas: () => { toDataURL: (format: string) => string }
  clear: () => void
}

interface Props {
  field: RHFField
  name?: string
  sigRef: React.RefObject<SigRef | null>
}

interface ModType {
  default:
    | React.ComponentType<{
        ref: React.RefObject<unknown>
        penColor: string
        backgroundColor: string
        canvasProps: { width: number; height: number; className: string }
        onEnd: () => void
      }>
    | {
        SignatureCanvas: React.LazyExoticComponent<
          React.ComponentType<{
            ref: React.RefObject<unknown>
            penColor: string
            backgroundColor: string
            canvasProps: { width: number; height: number; className: string }
            onEnd: () => void
          }>
        >
      }
  SignatureCanvas: React.ComponentType<{
    ref: React.RefObject<unknown>
    penColor: string
    backgroundColor: string
    canvasProps: { width: number; height: number; className: string }
    onEnd: () => void
  }>
}

const SigCanvasLazy = React.lazy(() =>
  import('react-signature-canvas').then((mod: ModType) => {
    const C =
      typeof mod.default === 'function'
        ? mod.default
        : typeof mod.SignatureCanvas === 'function'
          ? mod.SignatureCanvas
          : (mod.default?.SignatureCanvas ?? mod)
    return { default: C }
  }),
)

export const SignatureInput = ({ field, name = 'Signature', sigRef }: Props) => {
  const handleEnd = () => {
    const url = sigRef.current?.isEmpty()
      ? ''
      : sigRef.current?.getTrimmedCanvas().toDataURL('image/png')
    field.onChange(url)
  }

  const clear = () => {
    sigRef.current?.clear()
    field.onChange('')
  }

  return (
    <FormItem>
      <FormLabel>{name}</FormLabel>
      <div className='border rounded-md h-[150px] w-full flex items-center justify-center bg-white'>
        {typeof window !== 'undefined' ? (
          <Suspense fallback={<span className='text-sm text-gray-400'>Loading…</span>}>
            {/* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */}
            {(() => {
              return (
                <SigCanvasLazy
                  ref={sigRef}
                  penColor='black'
                  backgroundColor='transparent'
                  canvasProps={{ width: 500, height: 150, className: 'w-full' }}
                  onEnd={handleEnd}
                />
              )
            })()}
          </Suspense>
        ) : null}
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
