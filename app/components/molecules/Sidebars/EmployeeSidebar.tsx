import {
  BookOpen,
  Building2,
  Calculator,
  ChevronDown,
  ClipboardList,
  DollarSign,
  FileIcon,
  ImageIcon,
  Layers,
  Lightbulb,
  type LucideProps,
  Mail,
  MailIcon,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  ShowerHead,
  User,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useFetcher, useLoaderData, useLocation } from 'react-router'
import { Collapsible } from '~/components/Collapsible'
import { CorbelIcon } from '~/components/icons/CorbelIcon'
import { SinkIcon } from '~/components/icons/SinkIcon'
import { LinkButton } from '~/components/molecules/LinkButton'
import { SuperAdminCompanySelect } from '~/components/molecules/SuperAdminCompanySelect'
import { Button } from '~/components/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '~/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'
import { useSuperAdminCompanySwitch } from '~/hooks/useSuperAdminCompanySwitch'
import type { ISupplier } from '~/schemas/suppliers'
import { getMirroredUrl } from '~/utils/headerNav'
import { getBase } from '~/utils/urlHelpers'
import { FaucetsFilters } from './FaucetsFilters'
import { SinksFilters } from './SinksFilters'
import { StonesFilters } from './StonesFilters'

interface ISidebarItem {
  title: string
  url: string
  icon: React.ForwardRefExoticComponent<
    Omit<LucideProps, 'ref'> & React.RefAttributes<SVGSVGElement>
  >
  component?: () => React.ReactNode
}

interface IProps {
  suppliers: ISupplier[] | undefined
  sinkSuppliers?: ISupplier[] | undefined
  faucetSuppliers?: ISupplier[] | undefined
  colors?: { id: number; name: string; hex_code: string }[] | undefined
}

const getItems = (
  base: string,
  suppliers: ISupplier[] | undefined,
  colors?: { id: number; name: string; hex_code: string }[] | undefined,
  sinkSuppliers?: ISupplier[] | undefined,
  faucetSuppliers?: ISupplier[] | undefined,
  companyId?: number | string,
) => {
  if (base === 'shop') {
    return [
      {
        title: 'Transactions',
        url: '/shop/transactions',
        icon: DollarSign,
      },
      {
        title: 'Samples',
        url: '/shop/samples',
        icon: Package,
      },
    ]
  }
  const isCustomerRoute = base === 'customer'
  const isContractorsRoute = base === 'contractors'
  const finalList: ISidebarItem[] = [
    {
      title: 'Stones',
      url: isCustomerRoute
        ? `/customer/${companyId}/stones`
        : isContractorsRoute
          ? `/contractors/${companyId}/stones`
          : `/${base}/stones`,
      icon: Layers,
      component: () => (
        <StonesFilters suppliers={suppliers} base={base} colors={colors} />
      ),
    },
  ]
  if (base === 'employee') {
    finalList.push({
      title: 'Customers',
      url: `/employee/customers`,
      icon: Users,
    })
    finalList.push({
      title: 'Deals',
      url: `/employee/deals`,
      icon: DollarSign,
    })
    finalList.push({
      title: 'Emails',
      url: `/employee/emails`,
      icon: MailIcon,
    })
  }
  if (['admin', 'employee'].includes(base)) {
    finalList.push(
      {
        title: 'Sinks',
        url: `/${base}/sinks`,
        icon: SinkIcon,
        component: () => <SinksFilters base={base} suppliers={sinkSuppliers} />,
      },

      {
        title: 'Faucets',
        url: `/${base}/faucets`,
        icon: ShowerHead,
        component: () => <FaucetsFilters base={base} suppliers={faucetSuppliers} />,
      },
      {
        title: 'Suppliers',
        url: `/${base}/suppliers`,
        icon: Building2,
      },
      {
        title: 'Supports',
        url: `/${base}/supports`,
        icon: CorbelIcon,
      },
      {
        title: 'Documents',
        url: `/${base}/documents`,
        icon: FileIcon,
      },
      {
        title: 'Images',
        url: `/${base}/images`,
        icon: ImageIcon,
      },
      {
        title: 'Instructions',
        url: `/${base}/instructions`,
        icon: Lightbulb,
      },
      {
        title: 'Teach Mode',
        url: `/${base}/teach-mode`,
        icon: BookOpen,
      },
    )
  }
  if (base === 'employee') {
    finalList.push(
      {
        title: 'Transactions',
        url: `/employee/transactions`,
        icon: DollarSign,
      },

      {
        title: 'Special Order',
        url: `/employee/special-order`,
        icon: Calculator,
      },
      {
        title: 'My Account',
        url: `/employee/user`,
        icon: User,
      },
      // {
      //   title: 'Schedule',
      //   url: `/employee/schedule`,
      //   icon: Calendar,
      // },
      {
        title: 'Samples',
        url: `/${base}/samples`,
        icon: Package,
      },
      {
        title: 'Checklists',
        url: `/employee/checklists`,
        icon: ClipboardList,
      },
    )
  }
  if (base === 'admin') {
    finalList.push(
      {
        title: 'Statistic',
        url: `/admin/statistics`,
        icon: DollarSign,
      },
      {
        title: 'Deals',
        url: `/admin/deals`,
        icon: DollarSign,
      },
      {
        title: 'Emails',
        url: `/admin/emails`,
        icon: Mail,
      },
      {
        title: 'Transactions',
        url: `/admin/transactions`,
        icon: DollarSign,
      },
      {
        title: 'Survey',
        url: `/admin/surveys`,
        icon: Receipt,
      },
      {
        title: 'User Panel',
        url: `/admin/users`,
        icon: Users,
      },
    )
  }

  return finalList
}

export function EmployeeSidebar({
  suppliers,
  sinkSuppliers,
  faucetSuppliers,
  colors,
}: IProps) {
  const location = useLocation()
  const base = getBase(location.pathname)
  const isCustomerRoute = location.pathname.startsWith('/customer/')
  const isContractorsRoute = location.pathname.startsWith('/contractors/')
  const data = useLoaderData<{
    user: {
      company_id: number
      is_admin: boolean
      is_superuser: boolean
      pined_bar?: number
    } | null
    superadminCompanies?: { id: number; name: string }[]
    activeCompanyId?: number
    userIsSuperAdmin?: boolean
    unreadEmailCount?: number
    token: string
  }>()

  let companyIdFromUrl: string | undefined
  if (isCustomerRoute) {
    companyIdFromUrl = location.pathname.split('/').filter(Boolean)[1]
  } else if (isContractorsRoute) {
    companyIdFromUrl = location.pathname.split('/').filter(Boolean)[1]
  }

  const companyId = companyIdFromUrl ?? data?.user?.company_id

  const { isMobile, setOpenMobile, setOpen } = useSidebar()
  const isAdminPage = location.pathname.startsWith('/admin')
  const isCustomerPage = location.pathname.startsWith('/customer')
  const targetPath = getMirroredUrl(isAdminPage, location)

  const superadminCompanies = data?.superadminCompanies ?? []
  const activeCompanyId = data?.activeCompanyId
  const userIsSuperAdmin = data?.userIsSuperAdmin ?? false
  const unreadEmailCount = data?.unreadEmailCount ?? 0
  const { handleCompanySwitch } = useSuperAdminCompanySwitch()

  const buildCustomerUrl = () => {
    if (!isCustomerPage && location.pathname.startsWith('/admin/stones')) {
      return `/customer/${companyId}/stones${location.search}`
    }
    return isCustomerPage
      ? `/employee/stones${location.search}`
      : `/customer/${companyId}/stones${location.search}`
  }

  const handleLinkClick = () => {
    if (isMobile) setOpenMobile(false)
  }

  const itemsBase =
    (base === 'employee' ||
    base === 'admin' ||
    base === 'customer' ||
    base === 'contractors' ||
    base === 'shop'
      ? base
      : null) || 'employee'

  const items = getItems(
    isCustomerRoute ? 'customer' : isContractorsRoute ? 'contractors' : itemsBase,
    suppliers,
    colors,
    sinkSuppliers,
    faucetSuppliers,
    companyId,
  )

  const inventoryTitles = ['Stones', 'Sinks', 'Faucets']

  const crmTitles = ['Customers', 'Deals', 'Statistic', 'Emails']
  const resourceTitles = [
    'Suppliers',
    'Supports',
    'Documents',
    'Images',
    'Instructions',
    'Teach Mode',
  ]
  const operationTitles = ['Suppliers', 'Checklists', 'Special Order']

  const inventoryItems = items.filter(item => inventoryTitles.includes(item.title))
  const crmItems = items.filter(item => crmTitles.includes(item.title))
  const resourcesItems = items.filter(item => resourceTitles.includes(item.title))
  const operationsItems =
    itemsBase === 'employee'
      ? items.filter(item => operationTitles.includes(item.title))
      : []

  const excluded = [
    ...inventoryTitles,
    ...crmTitles,
    ...resourceTitles,
    ...operationTitles,
  ]
  const otherItems = items.filter(item => !excluded.includes(item.title))

  // open states
  const [inventoryOpen, setInventoryOpen] = useState(
    inventoryItems.some(i => location.pathname.startsWith(i.url)),
  )
  const [crmOpen, setCrmOpen] = useState(
    crmItems.some(i => location.pathname.startsWith(i.url)),
  )
  const [resourcesOpen, setResourcesOpen] = useState(
    resourcesItems.some(i => location.pathname.startsWith(i.url)),
  )
  const [operationsOpen, setOperationsOpen] = useState(
    operationsItems.some(i => location.pathname.startsWith(i.url)),
  )

  const pinFetcher = useFetcher<{ pined_bar: number }>()
  const pinnedFromServer = Boolean(data?.user?.pined_bar)
  const isPinned =
    pinFetcher.state !== 'idle'
      ? !pinnedFromServer
      : pinFetcher.data
        ? Boolean(pinFetcher.data.pined_bar)
        : pinnedFromServer

  const handleTogglePin = () => {
    pinFetcher.submit(null, {
      method: 'post',
      action: '/api/users/toggle-pin-bar',
    })
  }

  const isIconHoverDesktopSidebar =
    (location.pathname.startsWith('/employee') ||
      location.pathname.startsWith('/admin')) &&
    !isMobile &&
    !isPinned

  return (
    <Sidebar
      collapsible={isIconHoverDesktopSidebar ? 'icon' : 'offcanvas'}
      onMouseEnter={isIconHoverDesktopSidebar ? () => setOpen(true) : undefined}
      onMouseLeave={isIconHoverDesktopSidebar ? () => setOpen(false) : undefined}
    >
      {isMobile && data?.user && itemsBase !== 'shop' && (
        <SidebarHeader className='py-2 px-3'>
          <div className='flex gap-2 justify-center'>
            {data.user.is_admin || data.user.is_superuser || userIsSuperAdmin ? (
              <Link to={targetPath} className='w-full' onClick={handleLinkClick}>
                <LinkButton className='select-none w-full'>
                  {isAdminPage ? 'Employee' : 'Admin'}
                </LinkButton>
              </Link>
            ) : null}
            <Link to={buildCustomerUrl()} className='w-full' onClick={handleLinkClick}>
              <LinkButton className='select-none w-full'>
                {isCustomerPage ? 'Employee' : 'Customer'}
              </LinkButton>
            </Link>
          </div>
          {(data.user.is_superuser || userIsSuperAdmin) && isAdminPage ? (
            <Link to='/admin/users' onClick={handleLinkClick}>
              <Button className='w-full'>Users</Button>
            </Link>
          ) : null}
          {userIsSuperAdmin && superadminCompanies.length > 0 && (
            <SuperAdminCompanySelect
              companies={superadminCompanies}
              activeCompanyId={activeCompanyId}
              currentCompanyId={companyId}
              onCompanyChange={handleCompanySwitch}
              className='w-full'
            />
          )}
        </SidebarHeader>
      )}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* INVENTORY */}
              {inventoryItems.length > 0 && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <button
                      type='button'
                      className='w-full flex items-center cursor-pointer'
                      onClick={() => setInventoryOpen(o => !o)}
                    >
                      <Package />
                      <span className='group-data-[collapsible=icon]:hidden'>
                        Inventory
                      </span>
                      <ChevronDown
                        className={`ml-auto transition-transform group-data-[collapsible=icon]:hidden ${inventoryOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </SidebarMenuButton>
                  <Collapsible
                    isOpen={inventoryOpen}
                    openDuration='duration-300'
                    closeDuration='duration-300'
                    className='pl-2'
                  >
                    <SidebarMenuSub>
                      {inventoryItems.map(sub => {
                        const isActive = location.pathname.startsWith(sub.url)
                        return (
                          <SidebarMenuSubItem key={sub.title}>
                            <SidebarMenuSubButton asChild isActive={isActive}>
                              <a
                                href={sub.url}
                                className='flex w-full items-center gap-2'
                              >
                                <sub.icon />
                                <span>{sub.title}</span>
                                {sub.title === 'Emails' && unreadEmailCount > 0 ? (
                                  <span className='ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold leading-4 text-white'>
                                    {unreadEmailCount}
                                  </span>
                                ) : null}
                              </a>
                            </SidebarMenuSubButton>
                            {sub.component && isActive && <sub.component />}
                          </SidebarMenuSubItem>
                        )
                      })}
                    </SidebarMenuSub>
                  </Collapsible>
                </SidebarMenuItem>
              )}

              {/* CRM */}
              {crmItems.length > 0 && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <button
                      type='button'
                      className='w-full flex items-center cursor-pointer'
                      onClick={() => setCrmOpen(o => !o)}
                    >
                      <Users />
                      <span className='group-data-[collapsible=icon]:hidden'>CRM</span>
                      <ChevronDown
                        className={`ml-auto transition-transform group-data-[collapsible=icon]:hidden ${crmOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </SidebarMenuButton>
                  <Collapsible
                    isOpen={crmOpen}
                    openDuration='duration-300'
                    closeDuration='duration-300'
                    className='pl-2'
                  >
                    <SidebarMenuSub>
                      {crmItems.map(sub => {
                        const isActive = location.pathname.startsWith(sub.url)
                        return (
                          <SidebarMenuSubItem key={sub.title}>
                            <SidebarMenuSubButton asChild isActive={isActive}>
                              <a
                                href={sub.url}
                                className='flex w-full items-center gap-2'
                              >
                                <sub.icon />
                                <span>{sub.title}</span>
                                {sub.title === 'Emails' && unreadEmailCount > 0 ? (
                                  <span className='ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold leading-4 text-white'>
                                    {unreadEmailCount}
                                  </span>
                                ) : null}
                              </a>
                            </SidebarMenuSubButton>
                            {sub.component && isActive && <sub.component />}
                          </SidebarMenuSubItem>
                        )
                      })}
                    </SidebarMenuSub>
                  </Collapsible>
                </SidebarMenuItem>
              )}

              {/* RESOURCES */}
              {resourcesItems.length > 0 && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <button
                      type='button'
                      className='w-full flex items-center cursor-pointer'
                      onClick={() => setResourcesOpen(o => !o)}
                    >
                      <FileIcon />
                      <span className='group-data-[collapsible=icon]:hidden'>
                        Resources
                      </span>
                      <ChevronDown
                        className={`ml-auto transition-transform group-data-[collapsible=icon]:hidden ${resourcesOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </SidebarMenuButton>
                  <Collapsible
                    isOpen={resourcesOpen}
                    openDuration='duration-300'
                    closeDuration='duration-300'
                    className='pl-2'
                  >
                    <SidebarMenuSub>
                      {resourcesItems.map(sub => {
                        const isActive = location.pathname.startsWith(sub.url)
                        return (
                          <SidebarMenuSubItem key={sub.title}>
                            <SidebarMenuSubButton asChild isActive={isActive}>
                              <a href={sub.url}>
                                <sub.icon />
                                <span>{sub.title}</span>
                              </a>
                            </SidebarMenuSubButton>
                            {sub.component && isActive && <sub.component />}
                          </SidebarMenuSubItem>
                        )
                      })}
                    </SidebarMenuSub>
                  </Collapsible>
                </SidebarMenuItem>
              )}

              {/* OPERATIONS */}
              {operationsItems.length > 0 && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <button
                      type='button'
                      className='w-full flex items-center cursor-pointer'
                      onClick={() => setOperationsOpen(o => !o)}
                    >
                      <Calculator />
                      <span className='group-data-[collapsible=icon]:hidden'>
                        Operations
                      </span>
                      <ChevronDown
                        className={`ml-auto transition-transform group-data-[collapsible=icon]:hidden ${operationsOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </SidebarMenuButton>
                  <Collapsible
                    isOpen={operationsOpen}
                    openDuration='duration-300'
                    closeDuration='duration-300'
                    className='pl-2'
                  >
                    <SidebarMenuSub>
                      {operationsItems.map(sub => {
                        const isActive = location.pathname.startsWith(sub.url)
                        return (
                          <SidebarMenuSubItem key={sub.title}>
                            <SidebarMenuSubButton asChild isActive={isActive}>
                              <a href={sub.url}>
                                <sub.icon />
                                <span>{sub.title}</span>
                              </a>
                            </SidebarMenuSubButton>
                            {sub.component && isActive && <sub.component />}
                          </SidebarMenuSubItem>
                        )
                      })}
                    </SidebarMenuSub>
                  </Collapsible>
                </SidebarMenuItem>
              )}

              {otherItems.map(item => {
                const isActive =
                  (isCustomerRoute || isContractorsRoute) && item.title === 'Stones'
                    ? location.pathname.includes('/stones')
                    : location.pathname.startsWith(item.url)

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <a href={item.url} className='flex w-full items-center gap-2'>
                        <item.icon />
                        <span className='group-data-[collapsible=icon]:hidden'>
                          {item.title}
                        </span>
                        {item.title === 'Emails' && unreadEmailCount > 0 ? (
                          <span className='ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold leading-4 text-white group-data-[collapsible=icon]:hidden'>
                            {unreadEmailCount}
                          </span>
                        ) : null}
                      </a>
                    </SidebarMenuButton>
                    {item.component && isActive && <item.component />}
                  </SidebarMenuItem>
                )
              })}

              {data?.user &&
                !isMobile &&
                (location.pathname.startsWith('/employee') ||
                  location.pathname.startsWith('/admin')) && (
                  <SidebarMenuItem className='mt-2 border-t border-sidebar-border pt-2 group-data-[collapsible=icon]:hidden'>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type='button'
                          onClick={handleTogglePin}
                          aria-label={isPinned ? 'Unpin sidebar' : 'Pin sidebar'}
                          aria-pressed={isPinned}
                          className={`group/pin flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-all duration-200 cursor-pointer ${
                            isPinned
                              ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                              : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                          }`}
                        >
                          <span className='transition-opacity duration-200'>
                            {isPinned ? 'Pinned' : 'Pin'}
                          </span>
                          <span className='relative inline-flex size-5 items-center justify-center'>
                            <PanelLeftClose
                              className={`absolute size-5 transition-all duration-300 ${
                                isPinned
                                  ? 'opacity-100 rotate-0 scale-100'
                                  : 'opacity-0 -rotate-90 scale-75'
                              }`}
                            />
                            <PanelLeftOpen
                              className={`absolute size-5 transition-all duration-300 ${
                                isPinned
                                  ? 'opacity-0 rotate-90 scale-75'
                                  : 'opacity-100 rotate-0 scale-100'
                              }`}
                            />
                          </span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side='right'>
                        {isPinned ? 'Unpin sidebar' : 'Pin sidebar'}
                      </TooltipContent>
                    </Tooltip>
                  </SidebarMenuItem>
                )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
