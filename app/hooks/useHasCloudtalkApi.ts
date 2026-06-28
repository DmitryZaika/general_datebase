import { useRouteLoaderData } from 'react-router'
import type { loader } from '~/root'

export function useHasCloudtalkApi(): boolean {
  const data = useRouteLoaderData<typeof loader>('root')
  return Boolean(data?.hasCloudtalkApi)
}
