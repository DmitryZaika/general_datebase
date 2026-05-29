export const DEAL_EDIT_DIALOG_CLASS =
  'flex h-auto max-h-[95dvh] min-h-[600px] flex-col justify-baseline overflow-hidden px-1 py-4 max-md:!fixed max-md:!left-0 max-md:!right-0 max-md:!top-[env(safe-area-inset-top,0px)] max-md:!bottom-[env(safe-area-inset-bottom,0px)] max-md:!h-auto max-md:!max-h-none max-md:!min-h-0 max-md:!w-full max-md:!max-w-none max-md:!translate-x-0 max-md:!translate-y-0 max-md:rounded-none max-md:pb-4 sm:max-w-[1100px] sm:px-2 sm:py-5 md:h-[95vh] md:overflow-hidden xl:max-w-[1200px] data-[state=closed]:animate-none data-[state=closed]:duration-0'

export type DealsBoardOutletContext = {
  dealEditEmbedded?: boolean
  dismissDealEdit?: () => void
}

export function isDealEditPath(pathname: string, dealsBasePath: string) {
  return pathname.includes(`${dealsBasePath}/edit/`)
}
