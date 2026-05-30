export function getSidebarRoot(pathname: string): 'employee' | 'admin' | null {
  const segments = pathname.split('/').filter(Boolean)
  if (segments[0] === 'employee' || segments[0] === 'admin') {
    return segments[0]
  }
  return null
}

export function getSidebarSection(pathname: string): string | null {
  const root = getSidebarRoot(pathname)
  if (!root) return null
  const section = pathname.split('/').filter(Boolean)[1]
  if (!section) return 'stones'
  return section
}

export function isSidebarSectionChange(from: string, to: string): boolean {
  const fromRoot = getSidebarRoot(from)
  const toRoot = getSidebarRoot(to)
  if (!fromRoot || !toRoot || fromRoot !== toRoot) return false
  const fromSection = getSidebarSection(from)
  const toSection = getSidebarSection(to)
  if (!fromSection || !toSection) return false
  return fromSection !== toSection
}

export function getEmployeeSidebarSection(pathname: string): string | null {
  if (getSidebarRoot(pathname) !== 'employee') return null
  return getSidebarSection(pathname)
}

export function isEmployeeSidebarSectionChange(from: string, to: string): boolean {
  return isSidebarSectionChange(from, to)
}

export function getAdminSidebarSection(pathname: string): string | null {
  if (getSidebarRoot(pathname) !== 'admin') return null
  return getSidebarSection(pathname)
}

export function isAdminSidebarSectionChange(from: string, to: string): boolean {
  return isSidebarSectionChange(from, to)
}
