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
  component?: () => React.ReactNode;
}

const getItems = (base: string) => {
  const finalList: ISidebarItem[] = [
    {
      title: "Stones",
      url: `/${base}/stones`,
      icon: Home,
      component: SubStonesItem,
    },
  ];
  if (["admin", "employee"].includes(base)) {
    finalList.push(
      {
        title: "Sinks",
        url: `/${base}/sinks`,
        icon: Inbox,
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

function SubStonesItem() {
  const [searchParams, setSearchParams] =
    useSafeSearchParams(stoneFilterSchema);
  // Функция, которая добавляет/убирает элемент в массиве `type`
  const toggleStoneType = (typeToToggle: StoneFilter["type"][number]) => {
    let { type } = searchParams;
    type = type ?? [];
    let newTypes;

    if (type.includes(typeToToggle)) {
      // Если уже выбран, убираем из массива
      newTypes = type.filter((t) => t !== typeToToggle);
    } else {
      // Иначе добавляем
      newTypes = [...type, typeToToggle];
    }

    // Обновляем параметры (Partial<T>): меняем только ключ `type`
    setSearchParams({ type: newTypes });
  };

  const toggleSelectAllTypes = () => {
    if (searchParams.type.length === STONE_TYPES.length) {
      setSearchParams({ type: ["granite"] });
    } else {
      setSearchParams({ type: STONE_TYPES });
    }
  };

  const toggleShowSoldOut = (val: string) => {
    const show_sold_out = searchParams.show_sold_out ?? true;
    setSearchParams({ show_sold_out: !show_sold_out });
  };
  const allTypesSelected = searchParams.type.length === STONE_TYPES.length;
  return (
    <SidebarMenuSub>
      <SidebarGroupLabel>
        Types{" "}
        <span
          className="text-blue-500 underline ml-2 cursor-pointer"
          onClick={toggleSelectAllTypes}
        >
          {allTypesSelected ? "Clear" : "Select all"}
        </span>
      </SidebarGroupLabel>
      {STONE_TYPES.map((item) => (
        <CheckOption
          value={item}
          key={item}
          selected={searchParams.type.includes(item)}
          toggleValue={toggleStoneType}
        />
      ))}
      <SidebarGroupLabel>Supplier</SidebarGroupLabel>
      <span className="ml-4">Coming Soon</span>

      <SidebarGroupLabel>Other</SidebarGroupLabel>
      <CheckOption
        value="Show sold out"
        selected={searchParams.show_sold_out}
        toggleValue={toggleShowSoldOut}
      />
    </SidebarMenuSub>
  );
}

export function EmployeeSidebar() {
  const location = useLocation();
  const base = getBase(location.pathname);
  const items = getItems(base as "employee" | "admin" | "customer");
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
