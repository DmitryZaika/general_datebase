import { type ReactNode, useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate, useNavigation } from 'react-router'
import { EmailChatSkeletonContent } from '~/components/organisms/EmailChatSkeletonContent'
import { Dialog, DialogContent } from '~/components/ui/dialog'

function isAdminEmailActionPath(pathname: string) {
  return pathname.includes('/admin/emails/chat/')
}

function getEmailDialogClassName() {
  return 'max-w-[100%] sm:max-w-[90%] sm:max-w-[900px] h-[95%] p-0 flex flex-col overflow-hidden'
}

export type AdminEmailsOutletContext = {
  dismissEmailAction: () => void
}

export function AdminEmailsShell({ children }: { children: ReactNode }) {
  const location = useLocation()
  const navigation = useNavigation()
  const navigate = useNavigate()
  const [emailActionDismissed, setEmailActionDismissed] = useState(false)

  const navPath = navigation.location?.pathname ?? ''
  const isOnEmailAction = isAdminEmailActionPath(location.pathname)
  const isNavigatingToEmailAction =
    navigation.state === 'loading' &&
    navPath !== location.pathname &&
    isAdminEmailActionPath(navPath)
  const isEmailActionLoading = isNavigatingToEmailAction
  const showEmailDialog =
    !emailActionDismissed && (isOnEmailAction || isNavigatingToEmailAction)

  useEffect(() => {
    if (navigation.state === 'idle' && !isAdminEmailActionPath(location.pathname)) {
      setEmailActionDismissed(false)
    }
  }, [navigation.state, location.pathname])

  useEffect(() => {
    if (
      emailActionDismissed &&
      navigation.state === 'idle' &&
      isAdminEmailActionPath(location.pathname)
    ) {
      navigate(
        { pathname: '/admin/emails', search: location.search },
        { replace: true },
      )
    }
  }, [
    emailActionDismissed,
    navigation.state,
    location.pathname,
    location.search,
    navigate,
  ])

  const dismissEmailAction = () => {
    setEmailActionDismissed(true)
  }

  const handleEmailDialogClose = (open: boolean) => {
    if (!open) {
      dismissEmailAction()
      navigate({ pathname: '/admin/emails', search: location.search })
    }
  }

  return (
    <>
      <div className={showEmailDialog ? 'pointer-events-none' : undefined}>
        {children}
      </div>
      {showEmailDialog ? (
        <div className='fixed inset-0 z-50'>
          <Dialog open={true} onOpenChange={handleEmailDialogClose}>
            <DialogContent className={getEmailDialogClassName()}>
              {isEmailActionLoading ? (
                <EmailChatSkeletonContent />
              ) : (
                <Outlet
                  context={{ dismissEmailAction } satisfies AdminEmailsOutletContext}
                />
              )}
            </DialogContent>
          </Dialog>
        </div>
      ) : null}
    </>
  )
}
