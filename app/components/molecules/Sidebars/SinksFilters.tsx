import { useNavigation } from "react-router";
import { SINK_TYPES } from "~/utils/constants";
import { useSafeSearchParams } from "~/hooks/use-safe-search-params";
import { sinkFilterSchema, SinkFilter } from "~/schemas/sinks";
import { CheckOption } from "~/components/molecules/CheckOption";
import { LinkSpan } from "~/components/atoms/LinkSpan";
import { useMemo, useCallback } from "react";

import { SidebarGroupLabel, SidebarMenuSub } from "~/components/ui/sidebar";

interface IProps {
  base: string;
}

export function SinksFilters({ base }: IProps) {
  const [searchParams, setSearchParams] = useSafeSearchParams(sinkFilterSchema);
  const navigation = useNavigation();
  const isSubmitting = useMemo(() => navigation.state !== "idle", [navigation.state]);
  
  const showSoldOutToggle = useMemo(() => ["admin", "employee"].includes(base), [base]);
  
  const allTypesSelected = useMemo(() => 
    searchParams?.type?.length === SINK_TYPES.length, 
    [searchParams.type]
  );

  const toggleSinkType = useCallback((typeToToggle: SinkFilter["type"][number]) => {
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

  const toggleSelectAllTypes = useCallback(() => {
    if (isSubmitting) return;
    
    const newType = searchParams?.type?.length === SINK_TYPES.length ? [] : [...SINK_TYPES];
    setSearchParams({ ...searchParams, type: newType });
  }, [isSubmitting, searchParams, setSearchParams]);

  const toggleShowSoldOut = useCallback((val: string) => {
    if (isSubmitting) return;
    
    const show_sold_out = searchParams.show_sold_out ?? false;
    setSearchParams({ ...searchParams, show_sold_out: !show_sold_out });
  }, [isSubmitting, searchParams, setSearchParams]);
  
  return (
    <SidebarMenuSub>
      <SidebarGroupLabel>
        Sink Types{" "}
        <LinkSpan
          className="ml-2"
          onClick={toggleSelectAllTypes}
          variant="blue"
          disabled={isSubmitting}
        >
          {allTypesSelected ? "Clear" : "Select all"}
        </LinkSpan>
      </SidebarGroupLabel>
      
      {SINK_TYPES.map((item) => (
        <CheckOption
          value={item}
          key={item}
          selected={searchParams.type ? searchParams.type.includes(item) : false}
          toggleValue={toggleSinkType}
          isLoading={isSubmitting}
        />
      ))}
      
      { showSoldOutToggle && (
        <>
          <CheckOption
            value="Show sold out"
            selected={!!searchParams.show_sold_out}
            toggleValue={toggleShowSoldOut}
            isLoading={isSubmitting}
            defaultChecked={false}
          />
        </>
      )}
    </SidebarMenuSub>
  );
} 