import { capitalizeFirstLetter } from "~/utils/words";
import { LoaderFunctionArgs, redirect, Outlet, useLocation } from "react-router";
import { useLoaderData } from "react-router";
import ModuleList from "~/components/ModuleList";
import { getEmployeeUser } from "~/utils/session.server";
import { ImageCard } from "~/components/organisms/ImageCard";
import { SuperCarousel } from "~/components/organisms/SuperCarousel";
import { useState, useEffect } from "react";
import { stoneFilterSchema } from "~/schemas/stones";
import { cleanParams } from "~/hooks/use-safe-search-params";
import { Stone, stoneQueryBuilder } from "~/utils/queries";
import { StoneSearch } from "~/components/molecules/StoneSearch";
import { StonesSort } from "~/components/molecules/StonesSort";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getEmployeeUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  const user = await getEmployeeUser(request);
  const [, searchParams] = request.url.split("?");
  const queryParams = new URLSearchParams(searchParams);
  const filters = stoneFilterSchema.parse(cleanParams(queryParams));
  const stones = await stoneQueryBuilder(filters, user.company_id);
  return { stones };
};

function InteractiveCard({
  stone,
  setCurrentId,
}: {
  stone: Stone;
  setCurrentId: (value: number) => void;
  stoneType: string;
}) {
  const displayedAmount = stone.amount > 0 ? stone.amount : "—";
  const displayedWidth = stone.width && stone.width > 0 ? stone.width : "—";
  const displayedLength = stone.length && stone.length > 0 ? stone.length : "—";
  const createdDate = new Date(stone.created_date);
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const isNew = createdDate > oneWeekAgo;
  const isOnSale = !!stone.on_sale;

  return (
    <div
      id={`stone-${stone.id}`}
      key={stone.id}
      className="relative group w-full module-item overflow-hidden"
      onAuxClick={(e) => {
        if (e.button === 1 && stone.url) {
          e.preventDefault();
          window.open(stone.url, "_blank");
        }
      }}
    >
      {isOnSale && (
        <div className="absolute top-[17px] left-[-40px] w-[140px] transform -rotate-45 z-10">
          <div className="text-center py-1 text-white font-bold text-sm bg-red-600 shadow-md">
            <span className="block relative z-10">ON SALE</span>
            <div className="absolute left-0 top-full border-l-[10px] border-l-transparent border-t-[10px] border-t-red-800" />
            <div className="absolute right-0 top-full border-r-[10px] border-r-transparent border-t-[10px] border-t-red-800" />
          </div>
        </div>
      )}
      <ImageCard
        type="slabs"
        itemId={stone.id}
        fieldList={{
          Avaliable: `${stone.available} / ${displayedAmount}`,
          Size: `${displayedLength} x ${displayedWidth}`,
          Price: stone.retail_price === 0 ? `Price by slab $${stone.cost_per_sqft}` : `$${stone.retail_price}`,
        }}
        title={stone.name}
      >
        <img
          src={stone.url || "/placeholder.png"}
          alt={stone.name || "Stone Image"}
          className="object-cover w-full h-40 border-2 border-blue-500 rounded cursor-pointer transition duration-200 ease-in-out transform hover:scale-[105%] hover:shadow-lg select-none"
          loading="lazy"
          onClick={() => setCurrentId(stone.id)}
        />
      </ImageCard>
      {stone.available === 0 && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 flex items-center justify-center cursor-pointer whitespace-nowrap"
        onClick={() => setCurrentId(stone.id)}>
          <div className="bg-red-500 text-white text-lg font-bold px-2 py-1 transform z-10 rotate-45 select-none "
          >
            Out of Stock
          </div>
        </div>
      )}
      {isNew && (
        <div className="absolute top-0 right-0 bg-green-500 text-white px-2 py-1 rounded-bl text-sm font-bold">
          New Color
        </div>
      )}
    </div>
  );
}

export default function Stones() {
  const { stones } = useLoaderData<typeof loader>();
  const [currentId, setCurrentId] = useState<number | undefined>(undefined);
  const [sortedStones, setSortedStones] = useState<Stone[]>(stones);

  useEffect(() => {
    const inStock = stones.filter(stone => Number(stone.available) > 0 && Boolean(stone.is_display));
    const outOfStock = stones.filter(stone => Number(stone.available) <= 0 && Boolean(stone.is_display));
    const notDisplayed = stones.filter(stone => !Boolean(stone.is_display));
    
    const sortedInStock = [...inStock].sort((a, b) => a.name.localeCompare(b.name));
    const sortedOutOfStock = [...outOfStock].sort((a, b) => a.name.localeCompare(b.name));
    const sortedNotDisplayed = [...notDisplayed].sort((a, b) => a.name.localeCompare(b.name));
    
    setSortedStones([...sortedInStock, ...sortedOutOfStock, ...sortedNotDisplayed]);
  }, [stones]);

 
  const priorityFunction = (a: Stone, b: Stone) => {

    return 0;
  };

  return (
    <>
     <div className="flex justify-between flex-wrap items-center items-end mb-2">
        <div className="flex items-center gap-4">
        <StonesSort 
          stones={stones} 
          onSortedStones={setSortedStones}
          priorityFn={priorityFunction}
        >
         
        </StonesSort>
       
        </div>
        <div className="flex-1 flex justify-center md:justify-end md:ml-auto">
            <StoneSearch userRole="admin" />
        </div>
      </div>
      
      <ModuleList>
        <div className="w-full col-span-full">
          <SuperCarousel
            type="stones"
            currentId={currentId}
            setCurrentId={setCurrentId}
            images={sortedStones}
          />
        </div>
        {sortedStones.map((stone) => (
          <InteractiveCard
            key={stone.id}
            stone={stone}
            setCurrentId={setCurrentId}
            stoneType={stone.type}
          />
        ))}
      </ModuleList>
      <Outlet />
    </>
  );
}
