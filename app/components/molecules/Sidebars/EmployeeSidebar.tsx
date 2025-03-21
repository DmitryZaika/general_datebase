import { Calendar, Home, Inbox, Search, Settings } from "lucide-react"
import { useLocation, useNavigate, Outlet } from "react-router";
import { Checkbox } from "~/components/ui/checkbox"
import { FormLabel } from "~/components/ui/form"
import { STONE_TYPES } from "~/utils/constants";
import { useSafeSearchParams } from "~/hooks/use-safe-search-params";
import { stoneFilterSchema, StoneFilter } from "~/schemas/stones";

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
} from "~/components/ui/sidebar"

const items = [
  {
    title: "Stones",
    url: "/employee/stones",
    icon: Home,
    component: SubStonesItem
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
]

interface ICheckOptionProps {
  value: StoneFilter["type"][number]
  selected: StoneFilter["type"]
  toggleValue: (val: StoneFilter["type"][number]) => void
}

function CheckOption({ value, selected, toggleValue }: ICheckOptionProps) {
  return (
    <div className="items-top flex space-x-2">
      <Checkbox id="terms1" checked={selected.includes(value)} onCheckedChange={() => toggleValue(value)}/>
      <div className="grid gap-1.5 leading-none">
        <label
          htmlFor="terms1"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {value}
        </label>
      </div>
    </div>

  )
}

function SubStonesItem() {
  const [searchParams, setSearchParams] = useSafeSearchParams(stoneFilterSchema);
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
  return (
    <SidebarMenuSub>
      <SidebarGroupLabel>Stone</SidebarGroupLabel>
      {STONE_TYPES.map((item) => (
        <CheckOption value={item} key={item} selected={searchParams.type} toggleValue={toggleStoneType}/>
      ))}
    </SidebarMenuSub>
  )
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
                  {item.component && <item.component />}
                </SidebarMenuItem>
              )})}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}

