import { OriginalSidebarTrigger } from './ui/sidebar'

interface SidebarToggleProps {
  isMobile: boolean
  isCheckIn: boolean
  isExternalMarketing: boolean
  isInstallerRoute: boolean
}

export function SidebarToggle({
  isMobile,
  isCheckIn,
  isExternalMarketing,
  isInstallerRoute,
}: SidebarToggleProps) {
  const shouldShow = !isCheckIn && !isExternalMarketing && !isInstallerRoute

  if (!shouldShow) return null

  if (isMobile) return null

  return <OriginalSidebarTrigger />
}
