import { useSearchParams } from 'react-router'
import type { ZodSchema } from 'zod'

function objectToURLSearchParams(obj: Record<string, unknown>): URLSearchParams {
  const sp = new URLSearchParams()
  for (const [key, val] of Object.entries(obj)) {
    sp.set(key, JSON.stringify(val))
  }
  return sp
}

export function cleanParams(searchParams: URLSearchParams): Record<string, unknown> {
  const rawObj: Record<string, unknown> = {}
  for (const [key, val] of searchParams.entries()) {
    try {
      rawObj[key] = JSON.parse(val)
    } catch {
      // If parsing fails, keep the value as is
      rawObj[key] = val
    }
  }
  return rawObj
}

export function useSafeSearchParams<T>(
  schema: ZodSchema<T>,
): [T, (values: Partial<T>) => void] {
  const [searchParams, setSearchParams] = useSearchParams()

  const rawObj = cleanParams(searchParams)

  const currentValues = schema.parse(rawObj)

  const updateSearchParams = (newValues: Partial<T>) => {
    const merged = { ...currentValues, ...newValues }
    const nextParsed = schema.parse(merged)
    const sp = objectToURLSearchParams(nextParsed as Record<string, unknown>)
    setSearchParams(sp)
  }

  return [currentValues, updateSearchParams]
}
