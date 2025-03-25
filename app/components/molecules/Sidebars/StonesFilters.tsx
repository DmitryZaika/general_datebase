import { useLocation, useNavigate, Outlet } from "react-router";
import { FormLabel } from "~/components/ui/form";
import { STONE_TYPES } from "~/utils/constants";
import { useSafeSearchParams } from "~/hooks/use-safe-search-params";
import { stoneFilterSchema, StoneFilter } from "~/schemas/stones";
import { CheckOption } from "~/components/molecules/CheckOption";
import { getBase } from "~/utils/urlHelpers";
import { ISupplier } from "~/schemas/suppliers";
import { LinkSpan } from "~/components/atoms/LinkSpan";
import { useState, useEffect, useRef } from "react";
import { Stone } from "~/utils/queries";

import { SidebarGroupLabel, SidebarMenuSub } from "~/components/ui/sidebar";

interface IProps {
  suppliers: ISupplier[] | undefined;
  base: string;
  stones?: Stone[];
}

export function StonesFilters({ suppliers, base, stones = [] }: IProps) {
  const [searchParams, setSearchParams] =
    useSafeSearchParams(stoneFilterSchema);
  const [isLoading, setIsLoading] = useState(false);
  const [showLoadingUI, setShowLoadingUI] = useState(false);
  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const cleanType = searchParams.type || ["granite"];
  const showSoldOutToggle = ["admin", "employee"].includes(base);
  
  useEffect(() => {
    if (isLoading) {
      loadingTimerRef.current = setTimeout(() => {
        setShowLoadingUI(true);
      }, 500);
    } else {
      setShowLoadingUI(false);
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
    }
    
    return () => {
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
      }
    };
  }, [isLoading]);

  const toggleStoneType = (typeToToggle: StoneFilter["type"][number]) => {
    if (isLoading) return;
    
    setIsLoading(true);
    let { type } = searchParams;
    type = type ?? [];
    let newTypes;

    if (type.includes(typeToToggle)) {
      newTypes = type.filter((t) => t !== typeToToggle);
    } else {
      newTypes = [...type, typeToToggle];
    }

    setSearchParams({ type: newTypes });
    
    setTimeout(() => setIsLoading(false), 300);
  };

  const toggleSelectAllTypes = () => {
    if (isLoading) return;
    
    setIsLoading(true);
    if (searchParams?.type?.length === STONE_TYPES.length) {
      setSearchParams({ type: ["granite"] });
    } else {
      setSearchParams({ type: [...STONE_TYPES] });
    }
    setTimeout(() => setIsLoading(false), 300);
  };

  const toggleShowSoldOut = (val: string) => {
    if (isLoading) return;
    
    setIsLoading(true);
    const show_sold_out = searchParams.show_sold_out ?? true;
    setSearchParams({ show_sold_out: !show_sold_out });
    setTimeout(() => setIsLoading(false), 300);
  };
  
  const toggleSupplier = (supplierId: number) => {
    if (isLoading) return;
    
    setIsLoading(true);
    setSearchParams({ 
      supplier: supplierId,
      type: [...STONE_TYPES]
    });
    setTimeout(() => setIsLoading(false), 300);
  };
  
  const allTypesSelected = searchParams?.type?.length === STONE_TYPES.length;
  
  return (
    <SidebarMenuSub>
      <SidebarGroupLabel>
        Types{" "}
        <LinkSpan
          className="ml-2"
          onClick={toggleSelectAllTypes}
          variant="blue"
          disabled={showLoadingUI}
        >
          {allTypesSelected ? "Clear" : "Select all"}
        </LinkSpan>
      </SidebarGroupLabel>
      
      {STONE_TYPES.map((item) => (
        <CheckOption
          value={item}
          key={item}
          selected={searchParams.type ? searchParams.type.includes(item) : false}
          toggleValue={toggleStoneType}
          isLoading={showLoadingUI}
        />
      ))}
      
      {Array.isArray(suppliers) && (
        <>
          <SidebarGroupLabel>Supplier {" "}
            { searchParams.supplier !== 0 && (
              <LinkSpan
                className="ml-2"
                onClick={() => toggleSupplier(0)}
                variant="blue"
                disabled={showLoadingUI}
              >
                Select all
              </LinkSpan>
            ) }
          </SidebarGroupLabel>
          
          {suppliers.map((supplier) => (
            <div
              key={supplier.id}
              onClick={() => !isLoading && toggleSupplier(supplier.id)}
              className={`p-1 cursor-pointer hover:bg-gray-100 transition-colors ${
                searchParams.supplier === supplier.id ? "bg-gray-100" : ""
              } ${showLoadingUI ? "opacity-60" : ""}`}
            >
              <LinkSpan
                isSelected={searchParams.supplier === supplier.id}
                disabled={showLoadingUI}
              >
                {supplier.supplier_name}
              </LinkSpan>
            </div>
          ))}
        </>
      )}

      { showSoldOutToggle && (
        <>
          <SidebarGroupLabel>Other</SidebarGroupLabel>
          <CheckOption
            value="Show sold out"
            selected={!!searchParams.show_sold_out}
            toggleValue={toggleShowSoldOut}
            isLoading={showLoadingUI}
          />
        </>
      )}
    </SidebarMenuSub>
  );
}
