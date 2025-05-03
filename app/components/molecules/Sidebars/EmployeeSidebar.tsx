import {
  LucideProps,
  Calendar,
  Home,
  Inbox,
  Search,
  Settings,
  DollarSign,
} from "lucide-react";
import { redirect, useLocation } from "react-router";
import { getBase } from "~/utils/urlHelpers";
import { StonesFilters } from "./StonesFilters";
import { SinksFilters } from "./SinksFilters";
import { ISupplier } from "~/schemas/suppliers";
import { useLoaderData } from "react-router";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "~/components/ui/sidebar";

interface ISidebarItem {
  title: string;
  url: string;
  icon: React.ForwardRefExoticComponent<
    Omit<LucideProps, "ref"> & React.RefAttributes<SVGSVGElement>
  >;
  component?: ({}) => React.ReactNode;
}



interface IProps {
  suppliers: ISupplier[] | undefined;
  sinkSuppliers?: ISupplier[] | undefined;
  colors?: { id: number; name: string; hex_code: string }[] | undefined;
}

const getItems = (
  base: string, 
  suppliers: ISupplier[] | undefined, 
  colors?: { id: number; name: string; hex_code: string }[] | undefined,
  sinkSuppliers?: ISupplier[] | undefined,
  companyId: number | string = 1
) => {
  const isCustomerRoute = base === "customer";
  const finalList: ISidebarItem[] = [
    {
      title: "Stones",
      url: isCustomerRoute ? `/customer/${companyId}/stones` : `/${base}/stones`,
      icon: Home,
      component: () => <StonesFilters suppliers={suppliers} base={base} colors={colors}/>,
    },
  ];
  if (["admin", "employee"].includes(base)) {
    finalList.push(
      {
        title: "Sinks",
        url: `/${base}/sinks`,
        icon: Inbox,
        component: () => <SinksFilters base={base} suppliers={sinkSuppliers}/>,
      },
      {
        title: "Suppliers",
        url: `/${base}/suppliers`,
        icon: Calendar,
      },
      {
        title: "Supports",
        url: `/${base}/supports`,
        icon: Search,
      },
      {
        title: "Documents",
        url: `/${base}/documents`,
        icon: Settings,
      },
      {
        title: "Images",
        url: `/${base}/images`,
        icon: Settings,
      },
      {
        title: "Instructions",
        url: `/${base}/instructions`,
        icon: Settings,
      },
    );
  }
  if (base === "employee") {
    finalList.push(
      {
        title: "Transactions",
        url: `/employee/transactions`,
        icon: DollarSign,
      },
      {
        title: "Special Order",
        url: `/employee/special-order`,
        icon: Settings,
      },
      {
        title: "My Account",
        url: `/employee/user`,
        icon: Settings,
      }
    );
  }
  if (base === "admin") {
    finalList.push(
      {
        title: "Transactions",
        url: `/admin/transactions`,
        icon: DollarSign,
      },
      {
        title: "User Panel",
        url: `/admin/users`,
        icon: Settings,
      }
    );
  }
  return finalList;
};

export function EmployeeSidebar({ suppliers, sinkSuppliers, colors }: IProps) {
  const location = useLocation();
  const base = getBase(location.pathname);
  const data = useLoaderData<{ user: { company_id: number } | null }>();
  const companyId = data?.user?.company_id || 1;
  
  const isCustomerRoute = typeof base === 'string' && base.startsWith('customer/');
  
  const itemsBase = isCustomerRoute ? "customer" : base as "employee" | "admin" | "customer";
  
  const items = getItems(itemsBase, suppliers, colors, sinkSuppliers, companyId);
  
  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Granite Depot</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive = isCustomerRoute && item.title === "Stones" 
                  ? location.pathname.includes("/stones") 
                  : location.pathname.startsWith(item.url);
                
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
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
