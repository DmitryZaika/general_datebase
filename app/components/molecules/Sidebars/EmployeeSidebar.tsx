import {
  type LucideProps,
  Building2,
  Calculator,
  Calendar,
  ClipboardList,
  DollarSign,
  FileIcon,
  ImageIcon,
  Layers,
  Lightbulb,
  Package,
  Receipt,
  ShowerHead,
  User,
  Users,
} from 'lucide-react'
import { useLoaderData, useLocation } from 'react-router'
import { CorbelIcon } from '~/components/icons/CorbelIcon'
import { SinkIcon } from '~/components/icons/SinkIcon'
import type { ISupplier } from '~/schemas/suppliers'
import { getBase } from '~/utils/urlHelpers'
import { FaucetsFilters } from './FaucetsFilters'
import { SinksFilters } from './SinksFilters'
import { StonesFilters } from './StonesFilters'



import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '~/components/ui/sidebar'

interface ISidebarItem {
  title: string
  url: string
  icon: React.ForwardRefExoticComponent<
    Omit<LucideProps, 'ref'> & React.RefAttributes<SVGSVGElement>
  >
  component?: ({}) => React.ReactNode
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
      {
        title: 'Schedule',
        url: `/employee/schedule`,
        icon: Calendar,
      },
      {
        title: 'Samples',
        url: `/${base}/samples`,
        icon: Package,
      },
      {
        title: "Checklists",
        url: `/employee/checklists`,
        icon: ClipboardList,
      },
    );
  }
  if (base === 'admin') {
    finalList.push(
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

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Granite Depot</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map(item => {
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
