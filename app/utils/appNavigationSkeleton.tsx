import { CustomersPageSkeleton } from '~/components/organisms/CustomersPageSkeleton'
import {
  DocumentsPageSkeleton,
  SuppliersPageSkeleton,
} from '~/components/organisms/DataTableSkeleton'
import { DealsBoardSkeleton } from '~/components/organisms/DealsBoardSkeleton'
import { EmailsPageSkeleton } from '~/components/organisms/EmailsPageSkeleton'
import { EmployeePageSkeleton } from '~/components/organisms/EmployeePageSkeleton'
import { InventoryCatalogSkeleton } from '~/components/organisms/InventoryCatalogSkeleton'
import { MediaGridSkeleton } from '~/components/organisms/MediaGridSkeleton'
import { CloudTalkPageSkeleton } from '~/components/organisms/SmsPage/CloudTalkPageSkeleton'

export function renderAppNavigationSkeleton(section: string | null, navPath: string) {
  const isAdmin = navPath.startsWith('/admin')
  if (section === 'deals') {
    return (
      <div className='flex min-h-0 flex-1 flex-col p-2'>
        <DealsBoardSkeleton showToolbar />
      </div>
    )
  }
  if (section === 'emails') {
    return (
      <div className='flex min-h-0 flex-1 flex-col'>
        <EmailsPageSkeleton />
      </div>
    )
  }
  if (section === 'customers') {
    return (
      <div className='flex min-h-0 flex-1 flex-col'>
        <CustomersPageSkeleton />
      </div>
    )
  }
  if (section === 'stones') {
    return (
      <div className='flex min-h-0 flex-1 flex-col p-2'>
        <InventoryCatalogSkeleton showToolbar fieldLineCount={4} />
      </div>
    )
  }
  if (section === 'sinks') {
    return (
      <div className='flex min-h-0 flex-1 flex-col p-2'>
        <InventoryCatalogSkeleton fieldLineCount={3} />
      </div>
    )
  }
  if (section === 'faucets') {
    return (
      <div className='flex min-h-0 flex-1 flex-col p-2'>
        <InventoryCatalogSkeleton fieldLineCount={2} />
      </div>
    )
  }
  if (section === 'images') {
    return (
      <MediaGridSkeleton
        showToolbar={isAdmin}
        layout={isAdmin ? 'admin' : 'module'}
        cardCount={isAdmin ? 18 : 14}
      />
    )
  }
  if (section === 'supports') {
    return (
      <div className='p-2'>
        <MediaGridSkeleton cardCount={14} />
      </div>
    )
  }
  if (section === 'documents') {
    return <DocumentsPageSkeleton />
  }
  if (section === 'suppliers') {
    return <SuppliersPageSkeleton />
  }
  if (section === 'cloudtalk') {
    return <CloudTalkPageSkeleton readOnly={isAdmin} />
  }
  return <EmployeePageSkeleton />
}
