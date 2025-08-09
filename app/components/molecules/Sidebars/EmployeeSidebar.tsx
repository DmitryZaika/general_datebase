import {
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
  Package,
  Receipt,
  ShowerHead,
  User,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { useLoaderData, useLocation } from 'react-router'
import { Collapsible } from '~/components/Collapsible'
import { CorbelIcon } from '~/components/icons/CorbelIcon'
import { SinkIcon } from '~/components/icons/SinkIcon'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '~/components/ui/sidebar'
import type { ISupplier } from '~/schemas/suppliers'
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
  companyId: number | string = 1,
) => {
  const isCustomerRoute = base === 'customer'
  const finalList: ISidebarItem[] = [
    {
      title: 'Stones',
      url: isCustomerRoute ? `/customer/${companyId}/stones` : `/${base}/stones`,
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
      // {
      //   title: 'Samples',
      //   url: `/${base}/samples`,
      //   icon: Package,
      // },
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
        title: 'Transactions',
        url: `/admin/transactions`,
        icon: DollarSign,
      },
      {
        title: 'Invoices',
        url: `/admin/invoices`,
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
  const data = useLoaderData<{ user: { company_id: number } | null }>()
  const companyId = data?.user?.company_id || 1

  const isCustomerRoute = typeof base === 'string' && base.startsWith('customer/')

  const itemsBase = isCustomerRoute
    ? 'customer'
    : (base as 'employee' | 'admin' | 'customer')

  const items = getItems(
    itemsBase,
    suppliers,
    colors,
    sinkSuppliers,
    faucetSuppliers,
    companyId,
  )

  const inventoryTitles = ['Stones', 'Sinks', 'Faucets'] as const
  const crmTitles = ['Customers', 'Deals'] as const
  const resourceTitles = ['Supports', 'Documents', 'Images', 'Instructions'] as const
  const operationTitles = ['Suppliers', 'Checklists', 'Special Order'] as const

  const inventoryItems = items.filter(item => inventoryTitles.includes(item.title))
  const crmItems = items.filter(item => crmTitles.includes(item.title))
  const resourcesItems = items.filter(item => resourceTitles.includes(item.title))
  const operationsItems = items.filter(item => operationTitles.includes(item.title))

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
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Granite Depot</SidebarGroupLabel>
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
                  isCustomerRoute && item.title === 'Stones'
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
