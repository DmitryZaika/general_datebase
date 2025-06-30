import { Label } from '@radix-ui/react-label'
import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import type { TCustomerSchema } from '~/schemas/sales'
import { CUSTOMER_ITEMS } from '~/utils/constants'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'

type ExtraItemKey = keyof typeof CUSTOMER_ITEMS

const valueKeys = {
  tripFee: 'miles',
  mitter_edge_price: 'amount',
  oversize_piece: 'sqft',
  ten_year_sealer: 'amount',
}

const HARDCODED_IGNORES = [
  'edge_price',
  'tear_out_price',
  'stove_price',
  'waterfall_price',
  'corbels_price',
  'seam_price',
]

interface DynamicAdditionProps {
  itemKey: ExtraItemKey
  itemData: any
  onRemove: (key: ExtraItemKey) => void
  onUpdate: (key: ExtraItemKey, data: any) => void
}

interface DynamicControlProps {
  itemKey: ExtraItemKey
  itemData: any
  onUpdate: (data: any) => void
  setIsPriceManuallySet: (isPriceManuallySet: boolean) => void
}

const DynamicControl = ({
  itemKey,
  itemData,
  itemType,
  onUpdate,
  setIsPriceManuallySet,
}: DynamicControlProps) => {
  if (typeof itemType === 'object') {
    return (
      <Select value={itemData} onValueChange={onUpdate}>
        <SelectTrigger className='min-w-[150px]'>
          <SelectValue placeholder='Select a slab' />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(itemType).map(([key, value]) => (
            <SelectItem key={key} value={value?.toString() || ''}>
              {key}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }
  return (
    <div className='min-w-[115px]'>
      <Label className='text-xs'>{itemKey.replaceAll('_', ' ')}</Label>
      <Input value={itemData} onChange={e => onUpdate(e.target.value)} />
    </div>
  )
}

const DynamicAddition = ({ itemKey, itemData, form, index }: DynamicAdditionProps) => {
  const context = CUSTOMER_ITEMS[itemKey]
  const inputwidth = 'min-w-[115px]'
  const [isPriceManuallySet, setIsPriceManuallySet] = useState(false)
  const current = form.watch(`rooms.${index}.extras.${itemKey}`)

  useEffect(() => {
    console.log('RUNNING', itemData)
    if (isPriceManuallySet) return
    console.log('CURRENT', current)
    let newPrice = context.priceFn(current)
    console.log('NEW PRICE', newPrice)
    if (Number.isNaN(newPrice)) {
      newPrice = 0
    }

    if (newPrice !== itemData.price) {
      form.setValue(`rooms.${index}.extras.${itemKey}.price`, newPrice)
    }
  }, [current, context, isPriceManuallySet])

  const handlePriceChange = (newPrice: number) => {
    setIsPriceManuallySet(true)
    form.setValue(`rooms.${index}.extras.${itemKey}.price`, newPrice)
  }

  return (
    <div className='p-2 rounded-md mb-2 '>
      <div className='flex items-start gap-2'>
        <div className='min-w-[120px] flex-shrink-0'>
          <div className='h-6'></div>
          <span className='font-medium text-sm capitalize'>
            {itemKey.replaceAll('_', ' ')}
          </span>
        </div>
        {Object.entries(CUSTOMER_ITEMS[itemKey])
          .filter(([key]) => key !== 'priceFn')
          .map(([key, value]) => (
            <DynamicControl
              key={key}
              itemKey={key}
              itemType={value}
              itemData={form.getValues(`rooms.${index}.extras.${itemKey}.${key}`)}
              onUpdate={data => {
                console.log('UPDATING', data)
                form.setValue(`rooms.${index}.extras.${itemKey}.${key}`, data)
              }}
              setIsPriceManuallySet={setIsPriceManuallySet}
            />
          ))}

        <div className={inputwidth}>
          <Label className='text-xs'>Price</Label>
          <Input
            value={itemData.price}
            onChange={e => handlePriceChange(parseFloat(e.target.value) || 0)}
          />
        </div>
        <div className='flex flex-col'>
          <div className='h-6'></div>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='h-10 w-10 p-0'
            onClick={() => onRemove(itemKey)}
          >
            <X className='h-4 w-4' />
          </Button>
        </div>
      </div>
    </div>
  )
}

interface DynamicAdditionsProps {
  items: Record<ExtraItemKey, any>
  form: UseFormReturn<TCustomerSchema>
  index: number
}

export const DynamicAdditions = ({ items, form, index }: DynamicAdditionsProps) => {
  const selectedItems = Object.keys(items) as ExtraItemKey[]
  if (selectedItems.length === 0) return null

  return (
    <div className='mt-4 space-y-2'>
      <h3 className='text-sm font-semibold text-gray-600'>Extra Items</h3>
      {selectedItems
        .filter(itemKey => !HARDCODED_IGNORES.includes(itemKey))
        .map(itemKey => (
          <DynamicAddition
            key={itemKey}
            itemKey={itemKey}
            itemData={items[itemKey]}
            form={form}
            index={index}
          />
        ))}
    </div>
  )
}
