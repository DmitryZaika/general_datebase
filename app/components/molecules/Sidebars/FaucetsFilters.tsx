import { useCallback, useEffect, useMemo, useState } from 'react'
import { FaChevronDown, FaChevronUp } from 'react-icons/fa'
import { useNavigation } from 'react-router'
import { LinkSpan } from '~/components/atoms/LinkSpan'
import { CheckOption } from '~/components/molecules/CheckOption'
import { SidebarGroupLabel, SidebarMenuSub } from '~/components/ui/sidebar'
import { useSafeSearchParams } from '~/hooks/use-safe-search-params'
import { type FaucetFilter, faucetFilterSchema } from '~/schemas/faucets'
import type { ISupplier } from '~/schemas/suppliers'
import { FAUCET_TYPES } from '~/utils/constants'

interface IProps {
  base: string
  suppliers?: ISupplier[]
}

export function FaucetsFilters({ base, suppliers }: IProps) {
  const [searchParams, setSearchParams] = useSafeSearchParams(faucetFilterSchema)
  const navigation = useNavigation()
  const isSubmitting = useMemo(() => navigation.state !== 'idle', [navigation.state])
  const [suppliersExpanded, setSuppliersExpanded] = useState(false)

  useEffect(() => {
    localStorage.setItem('faucetSuppliersExpanded', JSON.stringify(suppliersExpanded))
  }, [suppliersExpanded])

  useEffect(() => {
    if (searchParams.supplier !== 0) {
      setSuppliersExpanded(true)
    }
  }, [searchParams.supplier])

  const showSoldOutToggle = useMemo(() => ['admin', 'employee'].includes(base), [base])

  const clearTypeFilters = () => {
    if (isSubmitting) return
    setSearchParams({ ...searchParams, type: [] })
  }

  const toggleFaucetType = useCallback(
    (typeToToggle: FaucetFilter['type'][number]) => {
      if (isSubmitting) return

      const type = searchParams.type ?? []
      let newTypes: FaucetFilter['type']

      if (type.includes(typeToToggle)) {
        newTypes = type.filter(t => t !== typeToToggle)
      } else {
        newTypes = [...type, typeToToggle]
      }

      setSearchParams({ ...searchParams, type: newTypes })
    },
    [isSubmitting, searchParams, setSearchParams],
  )

  const toggleShowSoldOut = useCallback(() => {
    if (isSubmitting) return

    const show_sold_out = searchParams.show_sold_out ?? false
    setSearchParams({ ...searchParams, show_sold_out: !show_sold_out })
  }, [isSubmitting, searchParams, setSearchParams])

  const toggleSupplier = useCallback(
    (supplierId: number) => {
      if (isSubmitting) return

      setSearchParams({
        ...searchParams,
        supplier: supplierId,
      })
    },
    [isSubmitting, searchParams, setSearchParams],
  )

  const toggleSuppliersExpanded = useCallback(() => {
    setSuppliersExpanded(prev => !prev)
  }, [])

  return (
    <SidebarMenuSub>
      <SidebarGroupLabel>
        Faucet Types{' '}
        {searchParams.type && searchParams.type.length > 0 && (
          <LinkSpan
            className='ml-2'
            onClick={clearTypeFilters}
            variant='blue'
            disabled={isSubmitting}
          >
            Clear
          </LinkSpan>
        )}
      </SidebarGroupLabel>

      {FAUCET_TYPES.map(item => (
        <CheckOption
          value={item}
          key={item}
          selected={searchParams.type ? searchParams.type.includes(item) : false}
          toggleValue={toggleFaucetType}
          isLoading={isSubmitting}
        />
      ))}

      {Array.isArray(suppliers) && suppliers.length > 0 && (
        <>
          <SidebarGroupLabel
            onClick={toggleSuppliersExpanded}
            className='flex items-center cursor-pointer'
          >
            <span>Suppliers</span>{' '}
            {suppliersExpanded ? (
              <FaChevronUp className='ml-1 text-gray-500' size={12} />
            ) : (
              <FaChevronDown className='ml-1 text-gray-500' size={12} />
            )}
            {searchParams.supplier !== 0 && (
              <LinkSpan
                className='ml-2'
                onClick={e => {
                  e.stopPropagation()
                  toggleSupplier(0)
                }}
                variant='blue'
                disabled={isSubmitting}
              >
                Clear
              </LinkSpan>
            )}
          </SidebarGroupLabel>

          {suppliersExpanded &&
            suppliers.map(supplier => (
              <div
                key={supplier.id}
                onClick={() => toggleSupplier(Number(supplier.id))}
                className={`p-1 cursor-pointer hover:bg-gray-100 transition-colors ${
                  searchParams.supplier === Number(supplier.id) ? 'bg-gray-100' : ''
                } ${isSubmitting ? 'opacity-60' : ''}`}
              >
                <LinkSpan
                  isSelected={searchParams.supplier === Number(supplier.id)}
                  disabled={isSubmitting}
                >
                  {supplier.supplier_name}
                </LinkSpan>
              </div>
            ))}
        </>
      )}

      {showSoldOutToggle && (
        <CheckOption
          value='Show sold out'
          selected={!!searchParams.show_sold_out}
          toggleValue={toggleShowSoldOut}
          isLoading={isSubmitting}
          defaultChecked={false}
        />
      )}
    </SidebarMenuSub>
  )
}
