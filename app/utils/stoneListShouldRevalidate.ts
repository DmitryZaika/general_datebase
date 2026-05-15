import type { ShouldRevalidateFunctionArgs } from 'react-router'

export function stoneListShouldRevalidate(args: ShouldRevalidateFunctionArgs) {
  const { defaultShouldRevalidate, currentUrl, nextUrl, formMethod } = args
  if (formMethod !== undefined && formMethod !== 'GET') {
    return defaultShouldRevalidate
  }
  if (currentUrl.pathname !== nextUrl.pathname) {
    return defaultShouldRevalidate
  }
  const curr = new URLSearchParams(currentUrl.search)
  const next = new URLSearchParams(nextUrl.search)
  const currVm = curr.get('viewMode')
  const nextVm = next.get('viewMode')
  curr.delete('viewMode')
  next.delete('viewMode')
  if (curr.toString() === next.toString() && currVm !== nextVm) {
    return false
  }
  return defaultShouldRevalidate
}
