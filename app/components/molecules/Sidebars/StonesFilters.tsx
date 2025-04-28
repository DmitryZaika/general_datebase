import { useNavigation } from "react-router";
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
  colors?: { id: number; name: string; hex_code: string }[];
}

export function StonesFilters({ suppliers, colors, base, stones = [] }: IProps) {
  const [searchParams, setSearchParams] =
    useSafeSearchParams(stoneFilterSchema);
  const navigation = useNavigation();
  const isSubmitting = useMemo(() => navigation.state !== "idle", [navigation.state]);
  const [suppliersExpanded, setSuppliersExpanded] = useState(false);
  const [colorsExpanded, setColorsExpanded] = useState(false);
  
  useEffect(() => {
    localStorage.setItem('suppliersExpanded', JSON.stringify(suppliersExpanded));
    localStorage.setItem('colorsExpanded', JSON.stringify(colorsExpanded));
  }, [suppliersExpanded, colorsExpanded]);

  useEffect(() => {
    if (searchParams.supplier !== 0) {
      setSuppliersExpanded(true);
    }
  }, [searchParams.supplier]);
  
  const showSoldOutToggle = useMemo(() => ["admin", "employee"].includes(base), [base]);
  
  const hasTypeFilters = useMemo(() => 
    searchParams?.type && searchParams.type.length > 0, 
    [searchParams.type]
  );

  const hasColorFilters = useMemo(() => 
    searchParams?.colors && searchParams.colors.length > 0, 
    [searchParams.colors]
  );

  const hasLevelFilter = useMemo(() => {
    if (!searchParams?.levels || searchParams.levels.length !== 2) return false;
    const [min, max] = searchParams.levels;
    return !(min === 0 && max === 7);
  }, [searchParams.levels]);
 
  useEffect(() => {
    const storedColorsExpanded = localStorage.getItem('colorsExpanded');
    if (storedColorsExpanded) {
      setColorsExpanded(JSON.parse(storedColorsExpanded));
    }
  }, []);

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

  const toggleColor = useCallback((colorId: number) => {
    if (isSubmitting) return;
    
    const currentColors = searchParams.colors ?? [];
    let newColors;

    if (currentColors.includes(colorId)) {
      newColors = currentColors.filter(id => id !== colorId);
    } else {
      newColors = [...currentColors, colorId];
    }

    setSearchParams({ ...searchParams, colors: newColors });
  }, [isSubmitting, searchParams, setSearchParams]);

  const handleLevelChange = useCallback((newLevels: number[]) => {
    if (isSubmitting) return;
    


    setSearchParams({ ...searchParams, levels: newLevels });
  }, [isSubmitting, searchParams, setSearchParams]);

  const clearTypeFilters = useCallback(() => {
    if (isSubmitting) return;
    
    setSearchParams({ ...searchParams, type: [] });
  }, [isSubmitting, searchParams, setSearchParams]);

  const clearColorFilters = useCallback(() => {
    if (isSubmitting) return;
    
    setSearchParams({ ...searchParams, colors: [] });
  }, [isSubmitting, searchParams, setSearchParams]);

  const clearSupplierFilter = useCallback(() => {
    if (isSubmitting) return;
    
    setSearchParams({ ...searchParams, supplier: 0 });
  }, [isSubmitting, searchParams, setSearchParams]);

  const toggleShowSoldOut = useCallback((val: string) => {
    if (isSubmitting) return;
    
    const show_sold_out = searchParams.show_sold_out ?? true;
    setSearchParams({ ...searchParams, show_sold_out: !show_sold_out });
  }, [isSubmitting, searchParams, setSearchParams]);
  
  const toggleSupplier = useCallback((supplierId: number) => {
    if (isSubmitting) return;
    
    setSearchParams({ 
      ...searchParams,
      supplier: supplierId
    });
  }, [isSubmitting, searchParams, setSearchParams]);
  
  const toggleSuppliersExpanded = useCallback(() => {
    setSuppliersExpanded(prev => !prev);
  }, []);

  const clearLevelFilter = useCallback(() => {
    if (isSubmitting) return;
    
    setSearchParams({ ...searchParams, levels: [0, 7] });
  }, [isSubmitting, searchParams, setSearchParams]);

  return (
    <SidebarMenuSub>
      <SidebarGroupLabel>
        Types{" "}
        {hasTypeFilters && (
          <LinkSpan
            className="ml-2"
            onClick={clearTypeFilters}
            variant="blue"
            disabled={isSubmitting}
          >
            Clear
          </LinkSpan>
        )}
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

      {Array.isArray(colors) && colors.length > 0 && (
        <>
          <SidebarGroupLabel>
            Colors{" "}
            {hasColorFilters && (
              <LinkSpan
                className="ml-2"
                onClick={clearColorFilters}
                variant="blue"
                disabled={isSubmitting}
              >
                Clear
              </LinkSpan>
            )}
          </SidebarGroupLabel>
          {colors.map((color) => (
            <CheckOption
              key={color.id}
              value={color.name}
              selected={searchParams.colors ? searchParams.colors.includes(color.id) : false}
              toggleValue={() => toggleColor(color.id)}
              isLoading={isSubmitting}
              icon={
                <div 
                  className="w-3 h-3 mr-1 rounded-full inline-block" 
                  style={{ backgroundColor: color.hex_code }}
                />
              }
            />
          ))}
        </>
      )}
      
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
            {searchParams.supplier !== 0 && (
              <LinkSpan
                className="ml-2"
                onClick={(e) => {
                  e.stopPropagation();
                  clearSupplierFilter();
                }}
                variant="blue"
                disabled={isSubmitting}
              >
                Clear
              </LinkSpan>
            )}
          </SidebarGroupLabel>
          
          {suppliersExpanded && suppliers.map((supplier) => (
            <div
              key={supplier.id}
              onClick={() => toggleSupplier(supplier.id)}
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
      <SidebarGroupLabel>
        Level{" "}
        {hasLevelFilter && (
          <LinkSpan
            className="ml-2"
            onClick={clearLevelFilter}
            variant="blue"
            disabled={isSubmitting}
          >
            Clear
          </LinkSpan>
        )}
      </SidebarGroupLabel>
      <Slider defaultValue={searchParams.levels} onCommit={handleLevelChange} max={7} showTooltip={true} className="mt-8"/>
    </SidebarMenuSub>
  );
}
