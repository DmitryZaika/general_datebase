export const gbColumbus =
  'https://granite-database.s3.us-east-2.amazonaws.com/static-images/photo_2025-11-03_17-53-06.png'
export const gbIndianapolis =
  'https://granite-database.s3.us-east-2.amazonaws.com/static-images/logo.png.png'
export const gmqTops = 'https://gmqtops.com/wp-content/uploads/2023/01/logo-b.png'
export const graniteEmpire =
  'https://granite-database.s3.us-east-2.amazonaws.com/static-images/granite_empire_black.png'

export const loginLogo =
  'https://granite-database.s3.us-east-2.amazonaws.com/static-images/GM-icon-bezfona.png'
export const defaultLogo =
  'https://granite-database.s3.us-east-2.amazonaws.com/static-images/GM-icon-bezfona.png'

export const companyIdToUrl: Record<number, string> = {
  1: gbIndianapolis,
  3: gbColumbus,
  4: gmqTops,
  7: graniteEmpire,
}

export function getCompanyLogoUrl(companyId: number): string {
  return companyIdToUrl[companyId] ?? defaultLogo
}
