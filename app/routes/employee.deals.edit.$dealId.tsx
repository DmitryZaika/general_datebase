import { useLoaderData } from 'react-router'
import DealPage from '~/components/pages/DealPage'
import {
  createDealEditLoader,
  type DealEditLoaderData,
} from '~/lib/dealEditLoader.server'
import { getEmployeeUser } from '~/utils/session.server'

export const loader = createDealEditLoader(getEmployeeUser, '/employee/deals')

export default function DealEditLayout() {
  const { dealId, stages, history, currentListId, isClosed, isWon, closedAt, activities } =
    useLoaderData<DealEditLoaderData>()
  return (
    <DealPage
      dealId={dealId}
      stages={stages}
      history={history}
      currentListId={currentListId}
      isClosed={isClosed}
      isWon={isWon}
      closedAt={closedAt}
      activities={activities}
    />
  )
}
