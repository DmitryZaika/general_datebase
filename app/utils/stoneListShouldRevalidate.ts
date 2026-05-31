import type { ShouldRevalidateFunctionArgs } from 'react-router'

function stonesListBasePath(pathname: string): string | null {
  if (pathname === '/admin/stones' || pathname.startsWith('/admin/stones/')) {
    return '/admin/stones'
  }
  if (pathname === '/employee/stones' || pathname.startsWith('/employee/stones/')) {
    return '/employee/stones'
  }
  return null
}

function sameStoneListFilters(currentSearch: string, nextSearch: string): boolean {
  const curr = new URLSearchParams(currentSearch)
  const next = new URLSearchParams(nextSearch)
  curr.delete('viewMode')
  next.delete('viewMode')
  return curr.toString() === next.toString()
}

export function stoneListShouldRevalidate(args: ShouldRevalidateFunctionArgs) {
  const { defaultShouldRevalidate, currentUrl, nextUrl, formMethod } = args
  if (formMethod !== undefined && formMethod !== 'GET') {
    return defaultShouldRevalidate
  }

  const currentBase = stonesListBasePath(currentUrl.pathname)
  const nextBase = stonesListBasePath(nextUrl.pathname)
  if (
    currentBase &&
    nextBase &&
    currentBase === nextBase &&
    currentUrl.pathname !== nextUrl.pathname &&
    sameStoneListFilters(currentUrl.search, nextUrl.search)
  ) {
    return false
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
