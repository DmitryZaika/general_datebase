import { useLoaderData } from 'react-router'
import DealPage from '~/components/pages/DealPage'
import {
  createDealEditLoader,
  type DealEditLoaderData,
} from '~/lib/dealEditLoader.server'
import { getAdminUser } from '~/utils/session.server'

export const loader = createDealEditLoader(getAdminUser, '/admin/deals')

export default function AdminDealEditLayout() {
  const { dealId, stages, history, currentListId, activities, isWon } =
    useLoaderData<DealEditLoaderData>()
  return (
    <DealPage
      dealId={dealId}
      stages={stages}
      history={history}
      currentListId={currentListId}
      activities={activities}
      isWon={isWon}
    />
  )
}
