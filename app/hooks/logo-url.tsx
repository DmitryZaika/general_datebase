import { useQuery } from '@tanstack/react-query'

async function getCompanyLogo(companyId: number): Promise<string | null> {
  const response = await fetch(`/api/companyLogo/${companyId}`)
  if (!response.ok) {
    throw new Error('Failed to fetch company logo')
  }
  const data = await response.json()
  return data.companyLogo
}

export function useCompanyLogo(companyId: number) {
  const { data, isLoading } = useQuery({
    queryKey: ['companyLogo', companyId],
    queryFn: () => getCompanyLogo(companyId),
    enabled: !!companyId,
  })

  return {
    loading: isLoading,
    url: data,
  }
}