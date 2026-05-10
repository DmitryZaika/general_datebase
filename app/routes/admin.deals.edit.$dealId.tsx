import { useLoaderData } from 'react-router'
import DealPage from '~/components/pages/DealPage'
import {
  createDealEditLoader,
  type DealEditLoaderData,
} from '~/lib/dealEditLoader.server'
import { getAdminUser } from '~/utils/session.server'

export const loader = createDealEditLoader(getAdminUser, '/admin/deals')

export default function AdminDealEditLayout() {
  const {
    dealId,
    stages,
    history,
    currentListId,
    isClosed,
    closedAt,
    activities,
    notes,
    emails,
    customerEmails,
    imagesCount,
    documentsCount,
    currentUserName,
  } = useLoaderData<DealEditLoaderData>()
  return (
    <DealPage
      dealId={dealId}
      stages={stages}
      history={history}
      currentListId={currentListId}
      isClosed={isClosed}
      closedAt={closedAt}
      activities={activities}
      notes={notes}
      emails={emails}
      customerEmails={customerEmails}
      imagesCount={imagesCount}
      documentsCount={documentsCount}
      currentUserName={currentUserName}
    />
  )
}
