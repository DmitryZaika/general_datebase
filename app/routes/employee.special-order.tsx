import { motion } from 'framer-motion'
import { useState } from 'react'
import type { LoaderFunctionArgs, MetaFunction } from 'react-router'
import { useLoaderData, useLocation } from 'react-router'
import { PageLayout } from '~/components/PageLayout'
import { db } from '~/db.server'
import {
  EMPLOYEE_VIEW_ENTER,
  employeeViewMotionKey,
} from '~/utils/employeeViewEnterMotion'
import { selectMany } from '~/utils/queryHelpers'
import { getEmployeeUser } from '~/utils/session.server'
import { calculateSpecialOrder } from '~/utils/specialOrderCalculator'

export const meta: MetaFunction = () => {
  return [{ title: 'Special Order' }]
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getEmployeeUser(request)
  const rows = await selectMany<{ state_taxes: number | string | null }>(
    db,
    'SELECT state_taxes FROM company WHERE id = ?',
    [user.company_id],
  )
  const raw = rows[0]?.state_taxes
  const parsed = typeof raw === 'string' ? Number.parseFloat(raw) : Number(raw)
  const taxRate = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
  return { taxRate }
}

export default function SpecialOrder() {
  const location = useLocation()
  const [price, setPrice] = useState<number | undefined>()
  const [width, setWidth] = useState<number | undefined>()
  const [length, setLength] = useState<number | undefined>()
  const [slabs, setSlabs] = useState(1)
  const [deliveryCost, setDeliveryCost] = useState<number | undefined>()
  const { taxRate } = useLoaderData<typeof loader>()

  const minusSlab = () => {
    if (slabs > 1) {
      setSlabs(slabs - 1)
    }
  }

  function calculateTotal() {
    if (!width || !length || !price) {
      return {
        totalSquareFeet: '0.00',
        totalCost: '0.00',
        totalPrice: '0.00',
      }
    }

    const result = calculateSpecialOrder({
      pricePerSqft: price,
      lengthInches: length,
      widthInches: width,
      slabs,
      deliveryCost: deliveryCost || 0,
      taxRate,
    })

    return {
      totalSquareFeet: result.totalSquareFeet.toFixed(2),
      totalCost: result.totalCost.toFixed(2),
      totalPrice: result.costPerSqftWithDelivery.toFixed(2),
    }
  }

  const values = calculateTotal()

  return (
    <motion.div
      key={employeeViewMotionKey(location.pathname, location.search)}
      className='w-full min-h-0'
      {...EMPLOYEE_VIEW_ENTER}
    >
      <PageLayout
        className='bg-white p-5 rounded-lg shadow-[0px_-0px_5px_rgba(0,0,0,0.15)] max-w-lg mx-auto my-5'
        title='Special Order Calculator'
      >
        <label htmlFor='price-per-sqft' className='text-base block'>
          Price per Sqft:
        </label>
        <input
          type='number'
          id='price-per-sqft'
          placeholder='Enter price per sqft'
          value={price === undefined ? '' : price}
          onChange={e => setPrice(parseFloat(e.target.value))}
          step='1'
          className='w-full p-2 border border-gray-300 rounded-md text-base mb-4'
          onWheel={e => e.preventDefault()}
        />

        <label htmlFor='size' className='text-base block'>
          Size of Slab:
        </label>
        <div className='flex gap-2'>
          <input
            type='number'
            id='length'
            placeholder='Length (inches)'
            min='0'
            value={length === undefined ? '' : length}
            onChange={e => setLength(parseFloat(e.target.value))}
            step='1'
            className='w-1/2 p-2 border border-gray-300 rounded-md text-base'
            onWheel={e => e.preventDefault()}
          />
          <input
            type='number'
            id='width'
            placeholder='Width (inches)'
            min='0'
            value={width === undefined ? '' : width}
            onChange={e => setWidth(parseFloat(e.target.value))}
            step='1'
            className='w-1/2 p-2 border border-gray-300 rounded-md text-base'
            onWheel={e => e.preventDefault()}
          />
        </div>

        <label htmlFor='delivery-cost' className='text-base block'>
          Delivery cost (total):
        </label>
        <input
          type='number'
          id='delivery-cost'
          placeholder='Enter total delivery cost'
          value={deliveryCost === undefined ? '' : deliveryCost}
          onChange={e => setDeliveryCost(parseFloat(e.target.value))}
          step='1'
          className='w-full p-2 border border-gray-300 rounded-md text-base mb-4'
          onWheel={e => e.preventDefault()}
        />

        <div className='flex items-center w-64 gap-3 mb-4'>
          <label htmlFor='slabs' className='text-base'>
            Slabs:
          </label>
          <button
            className='select-none bg-gray-800 text-yellow-400 border-none py-2 px-3 text-xl rounded-md cursor-pointer'
            type='button'
            id='decrease-slabs'
            onClick={minusSlab}
          >
            -
          </button>
          <span id='slabs-amount' className='text-lg w-3 font-bold'>
            {slabs}
          </span>
          <button
            className='select-none bg-gray-800 text-yellow-400 border-none py-2 px-3 text-xl rounded-md cursor-pointer'
            type='button'
            id='increase-slabs'
            onClick={() => setSlabs(slabs + 1)}
          >
            +
          </button>
        </div>

        <div className='text-lg font-bold text-gray-800'>
          Cost $<span>{values.totalPrice}</span> per sqft
        </div>
        <div className='text-lg font-bold text-gray-800'>
          Total Square Feet: <span>{values.totalSquareFeet}</span> sqft
        </div>
        <div className='text-xl font-bold text-red-700'>
          Total Cost $<span>{values.totalCost}</span>
        </div>
      </PageLayout>
    </motion.div>
  )
}
