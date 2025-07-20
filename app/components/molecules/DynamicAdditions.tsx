import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { Button } from '~/components/ui/button'
import type { TCustomerSchema } from '~/schemas/sales'
import { CUSTOMER_ITEMS, HARDCODED_IGNORES } from '~/utils/constants'
import { replaceUnderscoresWithSpaces } from '~/utils/words'
import { FormField } from '../ui/form'
import { InputItem } from './InputItem'
import { SelectInput } from './SelectItem'

type ExtraItemKey = keyof typeof CUSTOMER_ITEMS

interface DynamicControlProps {
  target: ExtraItemKey
  itemKey: keyof (typeof CUSTOMER_ITEMS)[ExtraItemKey]
  form: UseFormReturn<TCustomerSchema>
  index: number
}

const DynamicControl = ({ itemKey, target, form, index }: DynamicControlProps) => {
  // TODO: remove hardcoded ogee and bullnose
  const current = eval(form.watch(`rooms.${index}.extras.${target}.edge_type`))
  const itemType = CUSTOMER_ITEMS[target][itemKey]
  if (typeof itemType === 'object') {
    return (
      <FormField
        control={form.control}
        name={`rooms.${index}.extras.${target}.${itemKey}`}
        render={({ field }) => (
          <SelectInput
            field={field}
            placeholder='Select option'
            name={replaceUnderscoresWithSpaces(itemKey)}
            options={Object.entries(itemType).map(([key, value]) => ({
              key: value,
              value: replaceUnderscoresWithSpaces(key),
            }))}
          />
        )}
      />
    )
  }

  if (target === 'edge_price' && typeof current !== 'function') {
    return null
  }
  return (
    <FormField
      control={form.control}
      name={`rooms.${index}.extras.${target}.${itemKey}`}
      render={({ field }) => (
        <InputItem
          name={replaceUnderscoresWithSpaces(itemKey)}
          placeholder={`Enter ${itemKey}`}
          field={field}
        />
      )}
    />
  )
}

interface DynamicAdditionProps {
  target: ExtraItemKey
  form: UseFormReturn<TCustomerSchema>
  index: number
}

export const DynamicAddition = ({ target, form, index }: DynamicAdditionProps) => {
  const context = CUSTOMER_ITEMS[target]
  const [isPriceManuallySet, setIsPriceManuallySet] = useState(false)

  const current = form.watch(`rooms.${index}.extras.${target}`) as Record<
    string,
    number
  >

  useEffect(() => {
    if (isPriceManuallySet) return
    let newPrice = context.priceFn(current)
    if (Number.isNaN(newPrice)) {
      newPrice = 0
    }

    if (newPrice !== current.price) {
      form.setValue(`rooms.${index}.extras.${target}.price`, newPrice)
    }
  }, [JSON.stringify(current), context, isPriceManuallySet])

  const handleRemove = () => {
    const extras = form.getValues(`rooms.${index}.extras`)
    const { [target]: _, ...rest } = extras
    form.setValue(`rooms.${index}.extras`, rest)
  }

  const isHardcoded = HARDCODED_IGNORES.includes(target)

  return (
    <div className='p-0 rounded-md mb-2 '>
      <div className='flex items-start gap-2'>
        <div className={`flex-shrink-0 ${isHardcoded ? 'hidden' : 'min-w-[120px]'}`}>
          <div className='h-6'></div>
          <span className='font-medium text-sm capitalize'>
            {target?.replaceAll('_', ' ')}
          </span>
        </div>
        {Object.keys(context)
          .filter(item => item !== 'priceFn')
          .map(item => (
            <DynamicControl
              key={item}
              target={target}
              itemKey={item}
              form={form}
              index={index}
            />
          ))}

        <FormField
          control={form.control}
          name={`rooms.${index}.extras.${target}.price`}
          render={({ field }) => (
            <InputItem
              name={'Price'}
              placeholder={`Enter Price`}
              field={{
                ...field,
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                  field.onChange(e)
                  setIsPriceManuallySet(true)
                },
              }}
              className='min-w-[115px]'
            />
          )}
        />
        <div className='flex flex-col'>
          <div className='h-6'></div>
          {!isHardcoded && (
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='h-10 w-10 p-0'
              onClick={handleRemove}
            >
              <X className='h-4 w-4' />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

interface DynamicAdditionsProps {
  form: UseFormReturn<TCustomerSchema>
  index: number
}

export const DynamicAdditions = ({ form, index }: DynamicAdditionsProps) => {
  // Filter is a quick fix because it wants to include all price fields
  const selectedItems: ExtraItemKey[] = Object.keys(
    form.getValues(`rooms.${index}.extras`),
  ).filter(itemKey => !HARDCODED_IGNORES.includes(itemKey)) as ExtraItemKey[]
  if (selectedItems.length === 0) return null
  return (
    <div className='mt-4 space-y-2'>
      <h3 className='text-sm font-semibold text-gray-600'>Extra Items</h3>
      {selectedItems.map(itemKey => (
        <DynamicAddition key={itemKey} target={itemKey} form={form} index={index} />
      ))}
    </div>
  )
}
