import type { Location, Navigation } from 'react-router'

export function isEmployeeListFilterLoading(
  navigation: Navigation,
  location: Location,
  ignoredParams: string[] = ['viewMode'],
) {
  if (navigation.state !== 'loading' || !navigation.location) {
    return false
  }
  if (navigation.location.pathname !== location.pathname) {
    return false
  }
  const currentParams = new URLSearchParams(location.search)
  const nextParams = new URLSearchParams(navigation.location.search)
  for (const param of ignoredParams) {
    currentParams.delete(param)
    nextParams.delete(param)
  }
  return currentParams.toString() !== nextParams.toString()
}
