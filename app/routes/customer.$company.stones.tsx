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

interface Stone {
  id: number;
  name: string;
  type: string;
  url: string | null;
  is_display: boolean | number;
  height: number | null;
  available: number;
  width: number | null;
  amount: number | null;
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
  const stones = await stoneQueryBuilder(filters, params.company);

  return { stones };
};

interface InteractiveCardProps {
  stone: Stone;
  setCurrentId: (id: number, type: string) => void;
  stoneType: string;
}

function InteractiveCard({ stone, setCurrentId, stoneType }: InteractiveCardProps) {
  const displayedAmount = stone.amount && stone.amount > 0 ? stone.amount : "—";
  const displayedWidth = stone.width && stone.width > 0 ? stone.width : "—";
  const displayedHeight = stone.height && stone.height > 0 ? stone.height : "—";

  return (
    <div
      className="relative group w-full module-item"
      onAuxClick={(e) => {
        if (e.button === 1 && stone.url) {
          e.preventDefault();
          window.open(stone.url, "_blank");
        }
      }}
    >
      <ImageCard
        type="slabs"
        itemId={stone.id}
        fieldList={{
          Size: `${displayedHeight} x ${displayedWidth}`,
        }}
        title={stone.name}
      >
        <img
          src={stone.url || "/placeholder.png"}
          alt={stone.name || "Stone Image"}
          className="object-cover w-full h-40 border-2 border-blue-500 rounded cursor-pointer transition duration-200 ease-in-out transform hover:scale-[105%] hover:shadow-lg select-none"
          loading="lazy"
          onClick={() => setCurrentId(stone.id, stoneType)}
        />
      </ImageCard>
      {displayedAmount === "—" && (
        <div className="absolute top-15 left-1/2 transform -translate-x-1/2 flex items-center justify-center whitespace-nowrap">
          <div className="bg-red-500 text-white text-lg font-bold px-2 py-1 transform z-10 rotate-45 select-none">
            Out of Stock
          </div>
        </div>
      )}
    </div>
  );
}

export default function Stones() {
  const { stones } = useLoaderData<typeof loader>();
  const [currentId, setCurrentId] = useState<number | undefined>(undefined);
  const [activeType, setActiveType] = useState<string | undefined>(undefined);

  // Обработчик для клика по карточке камня
  const handleCardClick = (id: number, type: string) => {
    setCurrentId(id);
    setActiveType(type);
  };

  // Обработчик для карусели - принимает number | undefined
  const handleCarouselChange = (id: number | undefined) => {
    setCurrentId(id);
    
    if (id !== undefined) {
      // Если ID определен, найдем тип камня и обновим активный тип
      const stone = stones.find(s => s.id === id);
      if (stone) {
        setActiveType(stone.type);
      }
    } else {
      // Если ID не определен, сбросим активный тип
      setActiveType(undefined);
    }
  };

  return (
    <>
      <ModuleList>
        <div className="w-full col-span-full mb-4">
          <SuperCarousel
            type="stones"
            currentId={currentId}
            setCurrentId={handleCarouselChange}
            images={stones}
            activeType={activeType}
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
