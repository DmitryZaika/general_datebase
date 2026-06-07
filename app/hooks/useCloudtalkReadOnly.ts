import { useLocation } from 'react-router'

export function useCloudtalkReadOnly(): boolean {
  return useLocation().pathname.startsWith('/admin/cloudtalk')
}
