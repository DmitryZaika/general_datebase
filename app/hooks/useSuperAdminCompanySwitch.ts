import { useFetcher, useLocation } from 'react-router'
import { useAuthenticityToken } from 'remix-utils/csrf/react'

export function useSuperAdminCompanySwitch() {
  const fetcher = useFetcher()
  const location = useLocation()
  const token = useAuthenticityToken()

  const handleCompanySwitch = (value: string) => {
    fetcher.submit(
      {
        companyId: value,
        csrf: token,
        redirect: location.pathname + location.search,
      },
      {
        method: 'POST',
        action: '/api/superadmin/switchCompany',
      },
    )
  }

  return { handleCompanySwitch, fetcher }
}
