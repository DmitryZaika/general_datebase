import { Calendar, Home, Inbox, Search, Settings } from "lucide-react";
import { useLocation, useNavigate, Outlet } from "react-router";
import { FormLabel } from "~/components/ui/form";
import { STONE_TYPES } from "~/utils/constants";
import { useSafeSearchParams } from "~/hooks/use-safe-search-params";
import { stoneFilterSchema, StoneFilter } from "~/schemas/stones";
import { CheckOption } from "~/components/molecules/CheckOption";

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

const items = [
  {
    title: "Stones",
    url: "/employee/stones",
    icon: Home,
    component: SubStonesItem,
  },
  {
    title: "Sinks",
    url: "/employee/sinks",
    icon: Inbox,
  },
  {
    title: "Suppliers",
    url: "/employee/suppliers",
    icon: Calendar,
  },
  {
    title: "Supports",
    url: "/employee/supports",
    icon: Search,
  },
  {
    title: "Documents",
    url: "/employee/documents",
    icon: Settings,
  },
  {
    title: "Images",
    url: "/employee/images",
    icon: Settings,
  },
];

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
  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Application</SidebarGroupLabel>
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
