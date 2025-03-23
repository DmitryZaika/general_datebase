import { useLocation, useNavigate, Outlet } from "react-router";
import { FormLabel } from "~/components/ui/form";
import { STONE_TYPES } from "~/utils/constants";
import { useSafeSearchParams } from "~/hooks/use-safe-search-params";
import { stoneFilterSchema, StoneFilter } from "~/schemas/stones";
import { CheckOption } from "~/components/molecules/CheckOption";
import { getBase } from "~/utils/urlHelpers";
import { ISupplier } from "~/schemas/suppliers";
import { LinkSpan } from "~/components/atoms/LinkSpan";

import { SidebarGroupLabel, SidebarMenuSub } from "~/components/ui/sidebar";

interface IProps {
  suppliers: ISupplier[] | undefined;
  base: string;
}

export function StonesFilters({ suppliers, base }: IProps) {
  const [searchParams, setSearchParams] =
    useSafeSearchParams(stoneFilterSchema);
  const cleanType = searchParams.type || ["granite"];
  const showSoldOutToggle = ["admin", "employee"].includes(base)
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
    if (searchParams?.type?.length === STONE_TYPES.length) {
      setSearchParams({ type: ["granite"] });
    } else {
      setSearchParams({ type: STONE_TYPES });
    }
  };

  const toggleShowSoldOut = (val: string) => {
    const show_sold_out = searchParams.show_sold_out ?? true;
    setSearchParams({ show_sold_out: !show_sold_out });
  };
  const allTypesSelected = searchParams?.type?.length === STONE_TYPES.length;
  return (
    <SidebarMenuSub>
      <SidebarGroupLabel>
        Types{" "}
        <LinkSpan
          className="ml-2"
          onClick={toggleSelectAllTypes}
        >
          {allTypesSelected ? "Clear" : "Select all"}
        </LinkSpan>
      </SidebarGroupLabel>
      {STONE_TYPES.map((item) => (
        <CheckOption
          value={item}
          key={item}
          selected={searchParams.type.includes(item)}
          toggleValue={toggleStoneType}
        />
      ))}
      {Array.isArray(suppliers) && (
        <>
          <SidebarGroupLabel>Supplier {" "}
            { searchParams.supplier !== 0 && (
              <LinkSpan
                className="ml-2"
                onClick={() => setSearchParams({ supplier: 0 })}
              >
                Select all
              </LinkSpan>
            ) }
          </SidebarGroupLabel>
          {suppliers.map((supplier) => (
            <LinkSpan
              onClick={() => setSearchParams({ supplier: supplier.id })} key={supplier.id}
            >
              {supplier.supplier_name}
            </LinkSpan>
          ))}
        </>
      )}

      { showSoldOutToggle && (
        <>
          <SidebarGroupLabel>Other</SidebarGroupLabel>
          <CheckOption
            value="Show sold out"
            selected={searchParams.show_sold_out}
            toggleValue={toggleShowSoldOut}
          />
        </>
      )}
    </SidebarMenuSub>
  );
}
