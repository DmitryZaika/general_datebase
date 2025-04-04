import {
  LucideProps,
  Calendar,
  Home,
  Inbox,
  Search,
  Settings,
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

const getItems = (base: string, suppliers: ISupplier[] | undefined, sinkSuppliers?: ISupplier[] | undefined) => {
  const finalList: ISidebarItem[] = [
    {
      title: "Stones",
      url: `/${base}/stones`,
      icon: Home,
      component: () => <StonesFilters suppliers={suppliers} base={base}/>,
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
    finalList.push({
      title: "User Panel",
      url: `/admin/users`,
      icon: Settings,
    });
  }
  return finalList;
};

interface IProps {
  suppliers: ISupplier[] | undefined;
  sinkSuppliers?: ISupplier[] | undefined;
}

export function EmployeeSidebar({ suppliers, sinkSuppliers }: IProps) {
  const location = useLocation();
  const base = getBase(location.pathname);
  const items = getItems(base as "employee" | "admin" | "customer", suppliers, sinkSuppliers);
  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Granite Depot</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive = location.pathname.startsWith(item.url);
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
