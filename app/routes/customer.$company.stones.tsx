import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "~/components/ui/accordion";
import { capitalizeFirstLetter } from "~/utils/words";
import { LoaderFunctionArgs, Outlet, redirect } from "react-router";
import { selectMany } from "~/utils/queryHelpers";
import { db } from "~/db.server";
import { useLoaderData } from "react-router";
import ModuleList from "~/components/ModuleList";
import { ImageCard } from "~/components/organisms/ImageCard";
import { SuperCarousel } from "~/components/organisms/SuperCarousel";
import { useState } from "react";
import { stoneQueryBuilder } from "~/utils/queries";
import { StoneFilter, stoneFilterSchema } from "~/schemas/stones";
import { cleanParams } from "~/hooks/use-safe-search-params";
import { StoneSearch } from "~/components/molecules/StoneSearch";

interface Stone {
  id: number;
  name: string;
  type: string;
  url: string | null;
  is_display: boolean | number;
  length: number | null;
  available: number;
  width: number | null;
  amount: number | null;
  on_sale: boolean | number;
  created_date: string;
}

const customOrder = ["granite", "quartz", "marble", "dolomite", "quartzite"];

function customSortType(a: string, b: string) {
  return (
    customOrder.indexOf(a.toLowerCase()) - customOrder.indexOf(b.toLowerCase())
  );
}

function sortStones(a: Stone, b: Stone) {
  const aAmount = a.amount ?? 0;
  const bAmount = b.amount ?? 0;
  if (aAmount === 0 && bAmount !== 0) return 1;
  if (aAmount !== 0 && bAmount === 0) return -1;
  return a.name.localeCompare(b.name);
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const [, searchParams] = request.url.split("?");
  const queryParams = new URLSearchParams(searchParams);
  const filters = stoneFilterSchema.parse(cleanParams(queryParams));
  filters.show_sold_out = false;
  const stones = await stoneQueryBuilder(filters, Number(params.company));
  
  const colors = await selectMany<{
    id: number;
    name: string;
    hex_code: string;
  }>(db, "SELECT id, name, hex_code FROM colors ORDER BY name ASC");

  return { stones, colors };
};

interface InteractiveCardProps {
  stone: Stone;
  setCurrentId: (id: number, type: string) => void;
  stoneType: string;
}

function InteractiveCard({ stone, setCurrentId, stoneType }: InteractiveCardProps) {
  const displayedAmount = stone.amount && stone.amount > 0 ? stone.amount : "—";
  const displayedWidth = stone.width && stone.width > 0 ? stone.width : "—";
  const displayedLength = stone.length && stone.length > 0 ? stone.length : "—";
  const isOnSale = !!stone.on_sale;
  const createdDate = new Date(stone.created_date);
  const threeWeeksAgo = new Date();
  threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 60);
  const isNew = createdDate > threeWeeksAgo;

  return (
    <div
      id={`stone-${stone.id}`}
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
          Size: `${displayedLength} x ${displayedWidth}`,
          Type: capitalizeFirstLetter(stone.type)

        }}
        disabled={true}
        title={stone.name}
      >
        <img
          src={stone.url || "/placeholder.png"}
          alt={stone.name || "Stone Image"}
          className="object-cover w-full h-40 border-2 rounded cursor-pointer transition duration-200 ease-in-out transform hover:scale-[105%] hover:shadow-lg select-none"
          loading="lazy"
          onClick={() => setCurrentId(stone.id, stoneType)}
        />
      </ImageCard>
      {stone.available === 0 && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 flex items-center justify-center whitespace-nowrap">
          <div className="bg-red-500 text-white text-lg font-bold px-2 py-1 transform z-10 rotate-45 select-none">
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
  const { stones, colors } = useLoaderData<typeof loader>();
  const [currentId, setCurrentId] = useState<number | undefined>(undefined);
  const [activeType, setActiveType] = useState<string | undefined>(undefined);

  const handleCardClick = (id: number, type: string) => {
    setCurrentId(id);
    setActiveType(type);
  };

  const handleCarouselChange = (id: number | undefined) => {
    setCurrentId(id);
    
    if (id !== undefined) {
      const stone = stones.find(s => s.id === id);
      if (stone) {
        setActiveType(stone.type);
      }
    } else {
        setActiveType(undefined);
    }
  };

  return (
    <>
      <div className="flex justify-center sm:justify-end">
        <StoneSearch userRole="customer" />
      </div>
      
      <ModuleList>
        <div className="w-full col-span-full">
          <SuperCarousel
            type="stones"
            currentId={currentId}
            setCurrentId={handleCarouselChange}
            images={stones}
            userRole="customer"
          />
        </div>
        {stones.sort(sortStones).map((stone) => (
          <InteractiveCard
            key={stone.id}
            stone={stone}
            setCurrentId={handleCardClick}
            stoneType={stone.type}
          />
        ))}
      </ModuleList>
      <Outlet />
    </>
  );
}
