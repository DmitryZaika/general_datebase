import { capitalizeFirstLetter } from "~/utils/words";
import { LoaderFunctionArgs, redirect, Outlet, useLocation, Link, useSearchParams } from "react-router";
import { useLoaderData, useNavigate } from "react-router";
import ModuleList from "~/components/ModuleList";
import { getEmployeeUser } from "~/utils/session.server";
import { ImageCard } from "~/components/organisms/ImageCard";
import { SuperCarousel } from "~/components/organisms/SuperCarousel";
import { useState, useEffect } from "react";
import { stoneFilterSchema } from "~/schemas/stones";
import { cleanParams } from "~/hooks/use-safe-search-params";
import { Stone, stoneQueryBuilder } from "~/utils/queries";
import { StoneSearch } from "~/components/molecules/StoneSearch";
import { Button } from "~/components/ui/button";
import { TableIcon, GridIcon } from "@radix-ui/react-icons";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "~/components/ui/data-table";
import { SortableHeader } from "~/components/molecules/DataTable/SortableHeader";
import { useSafeSearchParams } from "~/hooks/use-safe-search-params";
import { StoneTable } from "~/components/organisms/StoneTable";
import { CheckIcon, MinusIcon } from "lucide-react";
import { useAuthenticityToken } from "remix-utils/csrf/react";
import { Input } from "~/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "~/components/ui/select";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  let user;
  try {
    user = await getEmployeeUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }

  const [, searchParams] = request.url.split("?");
  const queryParams = new URLSearchParams(searchParams);
  const filters = stoneFilterSchema.parse(cleanParams(queryParams));
  const stones = await stoneQueryBuilder(filters, user.company_id);
  return { stones };
};

export default function Samples() {
  const { stones } = useLoaderData<typeof loader>();
  const [currentId, setCurrentId] = useState<number | undefined>(undefined);
  const [sortedStones, setSortedStones] = useState<Stone[]>(stones);
  const [colorSort, setColorSort] = useState<boolean>(false);
  const token = useAuthenticityToken();

  useEffect(() => {
    const inStock = stones.filter(stone => Number(stone.available) > 0 && Boolean(stone.is_display));
    const outOfStock = stones.filter(stone => Number(stone.available) <= 0 && Boolean(stone.is_display));
    const notDisplayed = stones.filter(stone => !Boolean(stone.is_display));
    
    const sortedInStock = [...inStock].sort((a, b) => a.name.localeCompare(b.name));
    const sortedOutOfStock = [...outOfStock].sort((a, b) => a.name.localeCompare(b.name));
    const sortedNotDisplayed = [...notDisplayed].sort((a, b) => a.name.localeCompare(b.name));
    
    const baseSorted = [...sortedInStock, ...sortedOutOfStock, ...sortedNotDisplayed];
    if (!colorSort) {
      setSortedStones(baseSorted);
    } else {
      setSortedStones(sortByHighlight(baseSorted));
    }
  }, [stones]);

  // helper to determine severity: 2 red,1 yellow,0 none
  const getSeverity = (stone: Stone): number => {
    const imp = stone.samples_importance ?? 1;
    const amt = stone.samples_amount ?? 0;
    if (imp === 1) {
      if (amt < 2) return 2;
      if (amt < 4) return 1;
    }
    if (imp === 2) {
      if (amt < 3) return 2;
      if (amt < 6) return 1;
    }
    if (imp === 3) {
      if (amt < 5) return 2;
      if (amt < 7) return 1;
    }
    return 0;
  };

  const sortByHighlight = (list: Stone[]) => {
    return [...list].sort((a, b) => {
      const diff = getSeverity(b) - getSeverity(a);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name);
    });
  };

  const toggleColorSort = () => {
    setColorSort((prev) => {
      const next = !prev;
      if (next) {
        setSortedStones((prevList) => sortByHighlight(prevList));
      } else {
        // revert to base alphabetical/in stock order computed from stones
        const inStock = stones.filter(stone => Number(stone.available) > 0 && Boolean(stone.is_display));
        const outOfStock = stones.filter(stone => Number(stone.available) <= 0 && Boolean(stone.is_display));
        const notDisplayed = stones.filter(stone => !Boolean(stone.is_display));
        const sortedInStock = [...inStock].sort((a, b) => a.name.localeCompare(b.name));
        const sortedOutOfStock = [...outOfStock].sort((a, b) => a.name.localeCompare(b.name));
        const sortedNotDisplayed = [...notDisplayed].sort((a, b) => a.name.localeCompare(b.name));
        setSortedStones([...sortedInStock, ...sortedOutOfStock, ...sortedNotDisplayed]);
      }
      return next;
    });
  };

  async function updateSamplesAmount(stoneId: number, amount: number) {
    const formData = new FormData();
    formData.append("csrf", token);
    formData.append("amount", String(amount));
    const response = await fetch(`/api/stones/${stoneId}/samples`, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      console.error("Failed to update amount");
    }
  }

  async function updateSamplesImportance(stoneId: number, importance: number) {
    const formData = new FormData();
    formData.append("csrf", token);
    formData.append("importance", String(importance));
    const response = await fetch(`/api/stones/${stoneId}/samples`, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      console.error("Failed to update importance");
    }
  }

  const columns: ColumnDef<Stone>[] = [
    {
      id: "image",
      header: "Image",
      cell: ({ row }) => {
        const stone = row.original;
        const isOutOfStock = stone.available === 0;
        
        return (
          <div 
            className="w-12 h-12 overflow-hidden cursor-pointer relative"
            onClick={(e) => {
              e.stopPropagation();
              setCurrentId(stone.id);
            }}
          >
            <img 
              src={stone.url || "/placeholder.png"} 
              alt={stone.name} 
              className="object-cover w-full h-full"
            />
            {isOutOfStock && (
              <div className="absolute inset-0 flex items-center justify-center bg-red-500/70">
                <span className="text-white text-[8px] font-bold rotate-0 text-center leading-tight px-0.5">
                  Out of Stock
                </span>
              </div>
            )}
          </div>
        );
      }
    },
    {
      accessorKey: "name",
      header: ({ column }) => <SortableHeader column={column} title="Name" />,
      cell: ({ row }) => {
        return (
          <div 
            className="font-medium cursor-pointer" 
          
          >
            {row.original.name}
          </div>
        );
      }
    },
    {
      accessorKey: "amount",
      header: ({ column }) => <SortableHeader column={column} title="Amount" />,
      cell: ({ row }) => {
        const stone = row.original;
        const [value, setValue] = useState<number>(stone.samples_amount);
        const [firstFocus, setFirstFocus] = useState<boolean>(true);

        const save = async () => {
          await updateSamplesAmount(stone.id, value);
          setSortedStones((prev) =>
            prev.map((s) => (s.id === stone.id ? { ...s, samples_amount: value } : s)),
          );
        };

        return (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              value={value}
              onChange={(e) => setValue(Number(e.target.value) || 0)}
              className="w-20 px-2 py-1 border rounded"
              onFocus={(e) => {
                if (firstFocus) {
                  e.target.select();
                  setFirstFocus(false);
                }
              }}
              onBlur={save}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  save();
                }
              }}
            />
            <button
              className="p-1 text-green-600 hover:text-green-800"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                save();
              }}
            >
              <CheckIcon className="w-4 h-4" />
            </button>
          </div>
        );
      },
    },
    {
      id: "dec",
      header: "",
      cell: ({ row }) => {
        const stone = row.original;
        return (
          <button
            type="button"
            className="w-12 h-12 flex items-center justify-center bg-black text-white rounded-full"
            onClick={async (e) => {
              e.stopPropagation();
              const newAmount = Math.max(0, stone.samples_amount - 1);
              await updateSamplesAmount(stone.id, newAmount);
              setSortedStones((prev) =>
                prev.map((s) => (s.id === stone.id ? { ...s, samples_amount: newAmount } : s)),
              );
            }}
          >
            <MinusIcon className="cursor-pointer" style={{width: "40px", height: "40px"}} />
          </button>
        );
      },
    },
    {
      id: "importance",
      header: "Importance",
      cell: ({ row }) => {
        const stone = row.original;
        const [importance, setImportance] = useState<number>(stone.samples_importance ?? 1);

        const options = [
          { key: 3, label: "High" },
          { key: 2, label: "Medium" },
          { key: 1, label: "Low" },
        ];

        const handleChange = async (val: string) => {
          const num = Number(val);
          setImportance(num);
          await updateSamplesImportance(stone.id, num);
          setSortedStones((prev) =>
            prev.map((s) => (s.id === stone.id ? { ...s, samples_importance: num } : s)),
          );
        };

        return (
          <Select value={String(importance)} onValueChange={handleChange}>
            <SelectTrigger className="min-w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={String(opt.key)} value={String(opt.key)}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      },
    },
  
  ];

  return (
    <>
     <div className="flex justify-between flex-wrap items-center items-end mb-2 gap-2">
        <div className="flex-1 flex justify-center md:justify-end md:ml-auto">
          <StoneSearch 
            userRole="employee" 
            mode="samples" 
            onMinus={(stoneId) => {
              const stone = sortedStones.find((s) => s.id === stoneId);
              if (!stone) return;
              const newAmount = Math.max(0, stone.samples_amount - 1);
              updateSamplesAmount(stoneId, newAmount);
              setSortedStones((prev) =>
                prev.map((s) => (s.id === stoneId ? { ...s, samples_amount: newAmount } : s)),
              );
            }}
          />
        </div>
        <Button variant={colorSort ? "secondary" : "outline"} onClick={toggleColorSort} className="whitespace-nowrap">
          Out of stock
        </Button>
      </div>
   
        <StoneTable 
          stones={sortedStones} 
          columns={columns}
          enableHighlight={true}
        />
   
      
      <Outlet />
    </>
  );
}
