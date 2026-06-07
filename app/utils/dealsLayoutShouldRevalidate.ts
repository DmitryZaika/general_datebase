import type { ShouldRevalidateFunctionArgs } from 'react-router'
import { getDealEditRoot } from '~/utils/dealsBoardShell'

export function dealsLayoutShouldRevalidate(
  editPathPrefix: '/admin/deals' | '/employee/deals',
  args: ShouldRevalidateFunctionArgs,
): boolean {
  const { defaultShouldRevalidate, currentUrl, nextUrl, formMethod } = args
  if (formMethod !== undefined && formMethod !== 'GET') {
    return defaultShouldRevalidate
  }
  const cur = getDealEditRoot(currentUrl.pathname, editPathPrefix)
  const next = getDealEditRoot(nextUrl.pathname, editPathPrefix)
  if (cur !== null && next !== null && cur === next) {
    if (currentUrl.pathname === nextUrl.pathname && defaultShouldRevalidate) {
      return true
    }
    return false
  }
  return defaultShouldRevalidate
}
