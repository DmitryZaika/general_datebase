import type { ShouldRevalidateFunctionArgs } from 'react-router'

function stripToDealEditRoot(
  editPathPrefix: '/admin/deals' | '/employee/deals',
  pathname: string,
): string | null {
  const head = `${editPathPrefix}/edit/`
  if (!pathname.startsWith(head)) return null
  const rest = pathname.slice(head.length)
  const idMatch = /^(\d+)/.exec(rest)
  if (!idMatch) return null
  return `${head}${idMatch[1]}`
}

export function dealsLayoutShouldRevalidate(
  editPathPrefix: '/admin/deals' | '/employee/deals',
  args: ShouldRevalidateFunctionArgs,
): boolean {
  const { defaultShouldRevalidate, currentUrl, nextUrl, formMethod } = args
  if (formMethod !== undefined && formMethod !== 'GET') {
    return defaultShouldRevalidate
  }
  const cur = stripToDealEditRoot(editPathPrefix, currentUrl.pathname)
  const next = stripToDealEditRoot(editPathPrefix, nextUrl.pathname)
  if (cur !== null && next !== null && cur === next) return false
  return defaultShouldRevalidate
}
