import { type ReactNode, useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate, useNavigation } from 'react-router'
import { DealEditDialogSkeleton } from '~/components/organisms/DealEditDialogSkeleton'
import { Dialog, DialogContent } from '~/components/ui/dialog'
import {
  DEAL_EDIT_DIALOG_CLASS,
  type DealsBoardOutletContext,
  isDealEditPath,
} from '~/utils/dealsBoardShell'

export function DealsBoardShell({
  dealsBasePath,
  children,
}: {
  dealsBasePath: string
  children: ReactNode
}) {
  const location = useLocation()
  const navigation = useNavigation()
  const navigate = useNavigate()
  const [dealEditDismissed, setDealEditDismissed] = useState(false)

  const navPath = navigation.location?.pathname ?? ''
  const isOnDealEdit = isDealEditPath(location.pathname, dealsBasePath)
  const isNavigatingToDealEdit =
    navigation.state === 'loading' &&
    navPath !== location.pathname &&
    isDealEditPath(navPath, dealsBasePath)
  const isNavigatingAwayFromDealEdit =
    navigation.state === 'loading' &&
    isDealEditPath(location.pathname, dealsBasePath) &&
    navPath !== '' &&
    !isDealEditPath(navPath, dealsBasePath)
  const isClosingDealEdit = dealEditDismissed || isNavigatingAwayFromDealEdit
  const isDealEditLoading = isNavigatingToDealEdit && !isClosingDealEdit
  const showDealEditDialog =
    !isClosingDealEdit && (isOnDealEdit || isNavigatingToDealEdit)

  useEffect(() => {
    if (
      navigation.state === 'idle' &&
      !isDealEditPath(location.pathname, dealsBasePath)
    ) {
      setDealEditDismissed(false)
    }
  }, [navigation.state, location.pathname, dealsBasePath])

  const dismissDealEdit = () => {
    setDealEditDismissed(true)
  }

  const handleDealEditClose = (open: boolean) => {
    if (!open) {
      dismissDealEdit()
      navigate(`${dealsBasePath}${location.search}`, { replace: true })
    }
  }

  const outletContext: DealsBoardOutletContext = {
    dealEditEmbedded: true,
    dismissDealEdit,
  }

  const showSecondaryOutlet = !isOnDealEdit && !isNavigatingToDealEdit

  return (
    <>
      <div className={showDealEditDialog ? 'pointer-events-none' : undefined}>
        {children}
      </div>
      {showDealEditDialog ? (
        <div className='fixed inset-0 z-50'>
          <Dialog open={true} onOpenChange={handleDealEditClose}>
            <DialogContent hideClose className={DEAL_EDIT_DIALOG_CLASS}>
              {isDealEditLoading ? (
                <DealEditDialogSkeleton />
              ) : (
                <Outlet context={outletContext} />
              )}
            </DialogContent>
          </Dialog>
        </div>
      ) : showSecondaryOutlet ? (
        <Outlet />
      ) : null}
    </>
  )
}
