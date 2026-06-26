import { defaultLogo } from '~/constants/logos'

export const DEFAULT_COMPANY_LOGO_HEIGHT = 96
export const MIN_COMPANY_LOGO_HEIGHT = 32
export const MAX_COMPANY_LOGO_HEIGHT = 192

export function getHeaderCompanyId(
  pathname: string,
  sessionCompanyId: number | undefined,
): number | undefined {
  if (pathname.startsWith('/customer/')) {
    const id = Number.parseInt(pathname.split('/')[2] ?? '', 10)
    if (!Number.isNaN(id)) return id
  }
  if (pathname.startsWith('/contractors/')) {
    const id = Number.parseInt(pathname.split('/')[2] ?? '', 10)
    if (!Number.isNaN(id)) return id
  }
  return sessionCompanyId
}

export function resolveCompanyLogoUrl(logoUrl: string | null | undefined): string {
  if (typeof logoUrl === 'string' && logoUrl.trim() && logoUrl !== 'undefined') {
    return logoUrl
  }
  return defaultLogo
}

export function resolveCompanyLogoHeight(
  logoHeight: number | string | null | undefined,
): number {
  const parsed =
    typeof logoHeight === 'string'
      ? Number.parseInt(logoHeight, 10)
      : Number(logoHeight)
  if (!Number.isFinite(parsed)) {
    return DEFAULT_COMPANY_LOGO_HEIGHT
  }
  return Math.min(
    MAX_COMPANY_LOGO_HEIGHT,
    Math.max(MIN_COMPANY_LOGO_HEIGHT, Math.round(parsed)),
  )
}
