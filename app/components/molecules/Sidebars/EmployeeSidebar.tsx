import {
  LucideProps,
  Calendar,
  Home,
  Inbox,
  Search,
  Settings,
  DollarSign,
} from "lucide-react";
import { useLocation, useNavigate, Outlet } from "react-router";
import { FormLabel } from "~/components/ui/form";
import { STONE_TYPES } from "~/utils/constants";
import { useSafeSearchParams } from "~/hooks/use-safe-search-params";
import { stoneFilterSchema, StoneFilter } from "~/schemas/stones";
import { CheckOption } from "~/components/molecules/CheckOption";
import { getBase } from "~/utils/urlHelpers";
import { StonesFilters } from "./StonesFilters";
import { SinksFilters } from "./SinksFilters";
import { ISupplier } from "~/schemas/suppliers";

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
  sinkSuppliers?: ISupplier[] | undefined
) => {
  // For customer routes, we need to make sure the component is loaded properly
  const isCustomerRoute = base === "customer";
  
  const finalList: ISidebarItem[] = [
    {
      title: "Stones",
      url: isCustomerRoute ? `/customer/1/stones` : `/${base}/stones`,
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
    finalList.push({
      title: "Special Order",
      url: `/employee/special-order`,
      icon: Settings,
    },
    {
      title: "My Account",
      url: `/employee/user`,
      icon: Settings,
    });
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
  
  // Determine if we're in a customer route
  const isCustomerRoute = typeof base === 'string' && base.startsWith('customer/');
  
  // Use "customer" as the base for customer routes in getItems
  const itemsBase = isCustomerRoute ? "customer" : base as "employee" | "admin" | "customer";
  
  const items = getItems(itemsBase, suppliers, colors, sinkSuppliers);
  
  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Granite Depot</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                // Check if this route is active - for customer routes, check if pathname contains "stones"
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
