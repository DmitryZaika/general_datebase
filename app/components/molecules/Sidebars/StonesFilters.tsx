import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { FaChevronDown, FaChevronUp } from 'react-icons/fa'
import { useNavigation } from 'react-router'
import { LinkSpan } from '~/components/atoms/LinkSpan'
import { CheckOption } from '~/components/molecules/CheckOption'
import { SidebarGroupLabel, SidebarMenuSub } from '~/components/ui/sidebar'
import { useSafeSearchParams } from '~/hooks/use-safe-search-params'
import { stoneFilterSchema } from '~/schemas/stones'
import type { ISupplier } from '~/schemas/suppliers'
import { STONE_FINISHES, STONE_TYPES } from '~/utils/constants'

const isBrowser = typeof window !== 'undefined'

const safeLocalStorage = {
  getItem: (key: string): string | null => {
    if (!isBrowser) return null
    return localStorage.getItem(key)
  },
  setItem: (key: string, value: string): void => {
    if (!isBrowser) return
    localStorage.setItem(key, value)
  },
}

const LEVELS = [1, 2, 3, 4, 5, 6, 7]
const VISIBLE_ITEMS_COUNT = 2

interface FilterGroupProps<T> {
  title: string
  items: T[]
  renderItem: (item: T) => ReactNode
  hasFilter?: boolean
  onClear?: () => void
  collapsible?: boolean
  collapsed?: boolean
  onCollapseToggle?: () => void
  isSubmitting: boolean
  id?: string
  noShowAll?: boolean
}

function FilterGroup<T>({
  title,
  items,
  renderItem,
  hasFilter,
  onClear,
  collapsible,
  collapsed,
  onCollapseToggle,
  isSubmitting,
  id,
  noShowAll = false,
}: FilterGroupProps<T>) {
  const [showAll, setShowAll] = useState<boolean>(() => {
    if (id) {
      const savedState = safeLocalStorage.getItem(`showAll_${id}`)
      return savedState ? JSON.parse(savedState) : false
    }
    return false
  })

  const toggleShowAll = useCallback(() => {
    setShowAll((prev: boolean) => {
      const newState = !prev
      if (id) {
        safeLocalStorage.setItem(`showAll_${id}`, JSON.stringify(newState))
      }
      return newState
    })
  }, [id])

  const visibleItems = useMemo(() => {
    if (noShowAll || showAll || items.length <= VISIBLE_ITEMS_COUNT) return items
    return items.slice(0, VISIBLE_ITEMS_COUNT)
  }, [items, showAll, noShowAll])

  const headerContent = (
    <div className='flex items-center'>
      {collapsible ? (
        <>
          <span className='text-md'>{title}</span>
          {collapsed !== undefined &&
            (collapsed ? (
              <FaChevronDown className='ml-1 text-gray-500' size={12} />
            ) : (
              <FaChevronUp className='ml-1 text-gray-500' size={12} />
            ))}
        </>
      ) : (
        <p className='text-[14px] font-bold text-black'>{title}</p>
      )}
      {hasFilter && onClear && (
        <LinkSpan
          className='ml-2'
          onClick={e => {
            e.stopPropagation()
            onClear()
          }}
          variant='blue'
          disabled={isSubmitting}
        >
          Clear
        </LinkSpan>
      )}
    </div>
  )

  const header = collapsible ? (
    <SidebarGroupLabel
      onClick={onCollapseToggle}
      className='flex items-center cursor-pointer'
    >
      {headerContent}
    </SidebarGroupLabel>
  ) : (
    <SidebarGroupLabel className='flex items-center'>{headerContent}</SidebarGroupLabel>
  )

  return (
    <>
      {header}
      {(!collapsible || !collapsed) && (
        <>
          {visibleItems.map(renderItem)}
          {!noShowAll && items.length > VISIBLE_ITEMS_COUNT && (
            <div className='ml-2 mt-1 mb-2'>
              <LinkSpan
                onClick={toggleShowAll}
                variant='blue'
                className='text-xs'
                disabled={isSubmitting}
              >
                {showAll ? 'Show less' : 'Show more'}
              </LinkSpan>
            </div>
          )}
        </>
      )}
    </>
  )
}

interface FilterHandlerOptions<T extends object, V extends keyof T> {
  searchParams: T
  setSearchParams: (params: T) => void
  isSubmitting: boolean
  defaultValue?: object | number | string | number[]
  filterKey: V
  itemToValue?: (item: T) => number | string
}

function createToggleFilterHandler<T extends object, V extends keyof T>(
  options: FilterHandlerOptions<T, V>,
) {
  const {
    searchParams,
    setSearchParams,
    isSubmitting,
    defaultValue = [],
    filterKey,
    itemToValue,
  } = options

  return (item: T) => {
    if (isSubmitting) return

    const currentValues = searchParams[filterKey] ?? defaultValue
    const itemValue = itemToValue ? itemToValue(item) : item
    let newValues: number[] | string | number | string[] | object

    if (Array.isArray(currentValues)) {
      if (currentValues.includes(itemValue)) {
        newValues = currentValues.filter(val => val !== itemValue)
      } else {
        newValues = [...currentValues, itemValue]
      }

      if (typeof itemValue === 'number') {
        // @ts-ignore
        newValues.sort((a, b) => a - b)
      }

      // @ts-ignore
      if (newValues.length === 0 && defaultValue && !Array.isArray(defaultValue)) {
        newValues = defaultValue
      }
    } else newValues = currentValues === itemValue ? defaultValue : itemValue

    setSearchParams({ ...searchParams, [filterKey]: newValues })
  }
}

function createClearFilterHandler<T>(
  searchParams: T,
  setSearchParams: (params: T) => void,
  isSubmitting: boolean,
  filterKey: string,
  defaultValue: object | number | string,
) {
  return useCallback(() => {
    if (isSubmitting) return
    setSearchParams({ ...searchParams, [filterKey]: defaultValue })
  }, [searchParams, setSearchParams, isSubmitting, filterKey, defaultValue])
}

interface IProps {
  suppliers: ISupplier[] | undefined
  base: string
  colors?: { id: number; name: string; hex_code: string }[]
}

export function StonesFilters({ suppliers, colors, base }: IProps) {
  const [searchParams, setSearchParams] = useSafeSearchParams(stoneFilterSchema)
  const navigation = useNavigation()
  const isSubmitting = useMemo(() => navigation.state !== 'idle', [navigation.state])
  const [suppliersExpanded, setSuppliersExpanded] = useState(false)
  const [colorsExpanded, setColorsExpanded] = useState(false)

  useEffect(() => {
    safeLocalStorage.setItem('suppliersExpanded', JSON.stringify(suppliersExpanded))
    safeLocalStorage.setItem('colorsExpanded', JSON.stringify(colorsExpanded))
  }, [suppliersExpanded, colorsExpanded])

  useEffect(() => {
    if (searchParams.supplier !== 0) {
      setSuppliersExpanded(true)
    }
  }, [searchParams.supplier])

  const showSoldOutToggle = useMemo(() => ['admin', 'employee'].includes(base), [base])

  const hasTypeFilters = useMemo(
    () => searchParams?.type && searchParams.type.length > 0,
    [searchParams.type],
  )

  const hasColorFilters = useMemo(
    () => searchParams?.colors && searchParams.colors.length > 0,
    [searchParams.colors],
  )

  const hasLevelFilter = useMemo(() => {
    if (!searchParams?.level || searchParams.level.length === 0) return false

    if (searchParams.level.length === 2) {
      const [min, max] = searchParams.level
      return !(min === 0 && max === 8)
    }

    return searchParams.level.length > 0
  }, [searchParams.level])

  const hasFinishingFilters = useMemo(
    () => searchParams?.finishing && searchParams.finishing.length > 0,
    [searchParams.finishing],
  )

  useEffect(() => {
    const storedColorsExpanded = safeLocalStorage.getItem('colorsExpanded')
    if (storedColorsExpanded) {
      setColorsExpanded(JSON.parse(storedColorsExpanded))
    }
  }, [])

  const toggleSuppliersExpanded = () => setSuppliersExpanded(prev => !prev)

  const toggleStoneType = createToggleFilterHandler({
    searchParams,
    setSearchParams,
    isSubmitting,
    defaultValue: [],
    filterKey: 'type',
  })

  const toggleColor = createToggleFilterHandler({
    searchParams,
    setSearchParams,
    isSubmitting,
    defaultValue: [],
    filterKey: 'colors',
    // @ts-ignore
    itemToValue: color => color.id,
  })

  const toggleLevel = createToggleFilterHandler({
    searchParams,
    setSearchParams,
    isSubmitting,
    defaultValue: [],
    filterKey: 'level',
    // @ts-ignore
    itemToValue: (level: number | string) => {
      if (typeof level === 'string') {
        const match = level.match(/\d+/)
        return match ? parseInt(match[0]) : 0
      }
      return level
    },
  })

  const toggleSupplier = createToggleFilterHandler({
    searchParams,
    setSearchParams,
    isSubmitting,
    defaultValue: 0,
    filterKey: 'supplier',
    // @ts-ignore
    itemToValue: supplier => supplier.id,
  })

  const toggleShowSoldOut = () => {
    if (isSubmitting) return

    const show_sold_out = searchParams.show_sold_out ?? true
    setSearchParams({ ...searchParams, show_sold_out: !show_sold_out })
  }

  const toggleFinishing = createToggleFilterHandler({
    searchParams,
    setSearchParams,
    isSubmitting,
    defaultValue: [],
    filterKey: 'finishing',
  })

  const clearTypeFilters = createClearFilterHandler(
    searchParams,
    setSearchParams,
    isSubmitting,
    'type',
    [],
  )

  const clearColorFilters = createClearFilterHandler(
    searchParams,
    setSearchParams,
    isSubmitting,
    'colors',
    [],
  )

  const clearLevelFilter = createClearFilterHandler(
    searchParams,
    setSearchParams,
    isSubmitting,
    'level',
    [],
  )

  const clearSupplierFilter = createClearFilterHandler(
    searchParams,
    setSearchParams,
    isSubmitting,
    'supplier',
    0,
  )

  const clearFinishingFilters = createClearFilterHandler(
    searchParams,
    setSearchParams,
    isSubmitting,
    'finishing',
    [],
  )

  const isLevelSelected = useCallback(
    (level: number) => {
      if (!searchParams.level || searchParams.level.length === 0) {
        return false
      }

      if (
        searchParams.level.length === 2 &&
        ((searchParams.level[0] === 0 && searchParams.level[1] === 7) ||
          (searchParams.level[0] === 0 && searchParams.level[1] === 8))
      ) {
        return false
      }

      return searchParams.level.includes(level)
    },
    [searchParams.level],
  )

  return (
    <SidebarMenuSub>
      <FilterGroup
        title='Stone Types'
        items={[...STONE_TYPES]}
        renderItem={(item: (typeof STONE_TYPES)[number]) => (
          <CheckOption
            value={item}
            key={item}
            selected={searchParams.type ? searchParams.type.includes(item) : false}
            // @ts-ignore
            toggleValue={() => toggleStoneType(item)}
            isLoading={isSubmitting}
          />
        )}
        hasFilter={hasTypeFilters}
        onClear={clearTypeFilters}
        isSubmitting={isSubmitting}
        id='types'
        noShowAll={true}
      />

      <FilterGroup
        title='Finishing'
        items={[...STONE_FINISHES]}
        renderItem={(item: (typeof STONE_FINISHES)[number]) => (
          <CheckOption
            value={item.charAt(0).toUpperCase() + item.slice(1)}
            key={item}
            selected={
              searchParams.finishing ? searchParams.finishing.includes(item) : false
            }
            // @ts-ignore
            toggleValue={() => toggleFinishing(item)}
            isLoading={isSubmitting}
          />
        )}
        hasFilter={hasFinishingFilters}
        onClear={clearFinishingFilters}
        isSubmitting={isSubmitting}
        id='finishing'
        noShowAll={true}
      />

      {Array.isArray(colors) && colors.length > 0 && (
        <FilterGroup
          title='Stone Colors'
          items={colors}
          renderItem={color => (
            <CheckOption
              key={color.id}
              value={color.name}
              selected={
                searchParams.colors ? searchParams.colors.includes(color.id) : false
              }
              // @ts-ignore
              toggleValue={() => toggleColor(color)}
              isLoading={isSubmitting}
              icon={
                <div
                  className='w-3 h-3 mr-1 rounded-full inline-block'
                  style={{ backgroundColor: color.hex_code }}
                />
              }
            />
          )}
          hasFilter={hasColorFilters}
          onClear={clearColorFilters}
          isSubmitting={isSubmitting}
          id='colors'
        />
      )}
      <FilterGroup
        title='Stone Levels'
        items={LEVELS}
        renderItem={item => (
          <CheckOption
            value={`Level ${item}`}
            key={item}
            selected={isLevelSelected(item)}
            // @ts-ignore
            toggleValue={() => toggleLevel(`Level ${item}`)}
            isLoading={isSubmitting}
          />
        )}
        hasFilter={hasLevelFilter}
        onClear={clearLevelFilter}
        isSubmitting={isSubmitting}
        id='level'
      />
      {showSoldOutToggle && (
        <CheckOption
          value='Show sold out'
          selected={!!searchParams.show_sold_out}
          toggleValue={toggleShowSoldOut}
          isLoading={isSubmitting}
          defaultChecked={false}
        />
      )}

      {Array.isArray(suppliers) && (
        <FilterGroup
          title='Suppliers'
          items={
            suppliersExpanded ? suppliers : suppliers.slice(0, VISIBLE_ITEMS_COUNT)
          }
          renderItem={supplier => (
            <div
              key={supplier.id}
              // @ts-ignore
              onClick={() => toggleSupplier(supplier)}
              className={`p-1 cursor-pointer hover:bg-gray-100 transition-colors ${
                searchParams.supplier === supplier.id ? 'bg-gray-100' : ''
              } ${isSubmitting ? 'opacity-60' : ''}`}
            >
              <LinkSpan
                isSelected={searchParams.supplier === supplier.id}
                disabled={isSubmitting}
              >
                {supplier.supplier_name}
              </LinkSpan>
            </div>
          )}
          hasFilter={searchParams.supplier !== 0}
          onClear={clearSupplierFilter}
          collapsible={true}
          collapsed={!suppliersExpanded}
          onCollapseToggle={toggleSuppliersExpanded}
          isSubmitting={isSubmitting}
          id='suppliers'
          noShowAll={true}
        />
      )}
    </SidebarMenuSub>
  )
}
