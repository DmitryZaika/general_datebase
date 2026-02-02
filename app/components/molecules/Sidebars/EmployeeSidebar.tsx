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
  Receipt,
  ShowerHead,
  User,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useLoaderData, useLocation } from 'react-router'
import { Collapsible } from '~/components/Collapsible'
import { CorbelIcon } from '~/components/icons/CorbelIcon'
import { SinkIcon } from '~/components/icons/SinkIcon'
import { LinkButton } from '~/components/molecules/LinkButton'
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
      {
        title: 'Statistics',
        url: '/shop/statistics',
        icon: Calculator,
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
      {
        title: 'Statistic',
        url: `/admin/statistics`,
        icon: DollarSign,
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
    user: { company_id: number; is_admin: boolean; is_superuser: boolean } | null
  }>()

  let companyIdFromUrl: string | undefined
  if (isCustomerRoute) {
    companyIdFromUrl = location.pathname.split('/').filter(Boolean)[1]
  } else if (isContractorsRoute) {
    companyIdFromUrl = location.pathname.split('/').filter(Boolean)[1]
  }

  const companyId = companyIdFromUrl || data?.user?.company_id

  const { isMobile, setOpenMobile } = useSidebar()
  const isAdminPage = location.pathname.startsWith('/admin')
  const isCustomerPage = location.pathname.startsWith('/customer')
  const targetPath = getMirroredUrl(isAdminPage, location)

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
    base === 'contractors'
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

  return (
    <Sidebar>
      {isMobile && data?.user && (
        <SidebarHeader className='py-2 px-3'>
          <div className='flex gap-2 justify-center'>
            {data.user.is_admin || data.user.is_superuser ? (
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
          {data.user.is_superuser && isAdminPage ? (
            <Link to='/admin/users' onClick={handleLinkClick}>
              <Button className='w-full'>Users</Button>
            </Link>
          ) : null}
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
                      <span>Inventory</span>
                      <ChevronDown
                        className={`ml-auto transition-transform ${inventoryOpen ? 'rotate-180' : ''}`}
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
                      <span>CRM</span>
                      <ChevronDown
                        className={`ml-auto transition-transform ${crmOpen ? 'rotate-180' : ''}`}
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
                      <span>Resources</span>
                      <ChevronDown
                        className={`ml-auto transition-transform ${resourcesOpen ? 'rotate-180' : ''}`}
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
                      <span>Operations</span>
                      <ChevronDown
                        className={`ml-auto transition-transform ${operationsOpen ? 'rotate-180' : ''}`}
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
                      <a href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                    {item.component && isActive && <item.component />}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
