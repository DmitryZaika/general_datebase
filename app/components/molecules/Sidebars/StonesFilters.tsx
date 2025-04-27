import { useLocation, useNavigate, useNavigation, Outlet } from "react-router";
import { FormLabel } from "~/components/ui/form";
import { STONE_TYPES } from "~/utils/constants";
import { useSafeSearchParams } from "~/hooks/use-safe-search-params";
import { stoneFilterSchema, StoneFilter } from "~/schemas/stones";
import { CheckOption } from "~/components/molecules/CheckOption";
import { getBase } from "~/utils/urlHelpers";
import { ISupplier } from "~/schemas/suppliers";
import { LinkSpan } from "~/components/atoms/LinkSpan";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Stone } from "~/utils/queries";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";
import { Slider } from "~/components/ui/slider";

import { SidebarGroupLabel, SidebarMenuSub } from "~/components/ui/sidebar";

interface IProps {
  suppliers: ISupplier[] | undefined;
  base: string;
  stones?: Stone[];
}

export function StonesFilters({ suppliers, base, stones = [] }: IProps) {
  const [searchParams, setSearchParams] =
    useSafeSearchParams(stoneFilterSchema);
  const navigation = useNavigation();
  const isSubmitting = useMemo(() => navigation.state !== "idle", [navigation.state]);
  const navigate = useNavigate();
  const location = useLocation();
  const [suppliersExpanded, setSuppliersExpanded] = useState(false);
  

  useEffect(() => {
    localStorage.setItem('suppliersExpanded', JSON.stringify(suppliersExpanded));
  }, [suppliersExpanded]);
  

  useEffect(() => {
    if (searchParams.supplier !== 0) {
      setSuppliersExpanded(true);
    }
  }, [searchParams.supplier]);
  
  const cleanType = useMemo(() => searchParams.type || ["granite"], [searchParams.type]);
  const showSoldOutToggle = useMemo(() => ["admin", "employee"].includes(base), [base]);
  
  const allTypesSelected = useMemo(() => 
    searchParams?.type?.length === STONE_TYPES.length, 
    [searchParams.type]
  );



  const toggleStoneType = useCallback((typeToToggle: StoneFilter["type"][number]) => {
    if (isSubmitting) return;
    
    const type = searchParams.type ?? [];
    let newTypes;

    if (type.includes(typeToToggle)) {
      newTypes = type.filter((t) => t !== typeToToggle);
    } else {
      newTypes = [...type, typeToToggle];
    }

    setSearchParams({ ...searchParams, type: newTypes });
  }, [isSubmitting, searchParams, setSearchParams]);

  const handleLevelChange = useCallback((newLevels: number[]) => {
    if (isSubmitting) return;
    
    const type = searchParams.type ?? [];
    let newTypes;

    setSearchParams({ ...searchParams, levels: newLevels });
  }, [isSubmitting, searchParams, setSearchParams]);

  

  const toggleSelectAllTypes = useCallback(() => {
    if (isSubmitting) return;
    
    const newType = searchParams?.type?.length === STONE_TYPES.length ? [] : [...STONE_TYPES];
    setSearchParams({ ...searchParams, type: newType });
  }, [isSubmitting, searchParams, setSearchParams]);

  const toggleShowSoldOut = useCallback((val: string) => {
    if (isSubmitting) return;
    
    const show_sold_out = searchParams.show_sold_out ?? true;
    setSearchParams({ ...searchParams, show_sold_out: !show_sold_out });
  }, [isSubmitting, searchParams, setSearchParams]);
  
  const toggleSupplier = useCallback((supplierId: number) => {
    if (isSubmitting) return;
    
    setSearchParams({ 
      supplier: supplierId,
      type: [...STONE_TYPES]
    });
  }, [isSubmitting, setSearchParams]);
  
  const toggleSuppliersExpanded = useCallback(() => {
    setSuppliersExpanded(prev => !prev);
  }, []);
  
  return (
    <SidebarMenuSub>
      <SidebarGroupLabel>
        Types{" "}
        <LinkSpan
          className="ml-2"
          onClick={toggleSelectAllTypes}
          variant="blue"
          disabled={isSubmitting}
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
          isLoading={isSubmitting}
        />
      ))}

      
      
      {Array.isArray(suppliers) && (
        <>
          <SidebarGroupLabel 
            onClick={toggleSuppliersExpanded} 
            className="flex items-center cursor-pointer"
          >
            <span>Suppliers</span>{" "}
            {suppliersExpanded ? 
              <FaChevronUp className="ml-1 text-gray-500" size={12} /> : 
              <FaChevronDown className="ml-1 text-gray-500" size={12} />
            }
            { searchParams.supplier !== 0 && (
              <LinkSpan
                className="ml-2"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSupplier(0);
                }}
                variant="blue"
                disabled={isSubmitting}
              >
                Select all
              </LinkSpan>
            ) }
          </SidebarGroupLabel>
          
          {suppliersExpanded && suppliers.map((supplier) => (
            <div
              key={supplier.id}
              onClick={() =>  toggleSupplier(supplier.id)}
              className={`p-1 cursor-pointer hover:bg-gray-100 transition-colors ${
                searchParams.supplier === supplier.id ? "bg-gray-100" : ""
              } ${isSubmitting ? "opacity-60" : ""}`}
            >
              <LinkSpan
                isSelected={searchParams.supplier === supplier.id}
                disabled={isSubmitting}
              >
                {supplier.supplier_name}
              </LinkSpan>
            </div>
          ))}
        </>
      )}

      { showSoldOutToggle && (
        <CheckOption
          value="Show sold out"
          selected={!!searchParams.show_sold_out}
          toggleValue={toggleShowSoldOut}
          isLoading={isSubmitting}
          defaultChecked={false}
        />
      )}
      <SidebarGroupLabel>Level</SidebarGroupLabel>
      <Slider defaultValue={searchParams.levels} onCommit={handleLevelChange} max={7} showTooltip={true} className="mt-8"/>
    </SidebarMenuSub>
  );
}
