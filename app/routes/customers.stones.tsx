import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "~/components/ui/accordion";
import { capitalizeFirstLetter } from "~/utils/words";
import { LoaderFunctionArgs, redirect } from "react-router";
import { selectMany } from "~/utils/queryHelpers";
import { db } from "~/db.server";
import { useLoaderData } from "react-router";
import ModuleList from "~/components/ModuleList";
import { ImageCard } from "~/components/organisms/ImageCard";
import { SuperCarousel } from "~/components/organisms/SuperCarousel";
import { useState } from "react";

interface Stone {
  id: number;
  name: string;
  type: string;
  url: string | null;
  is_display: boolean | number;
  height: number | null;
  width: number | null;
  amount: number | null;
}

const customOrder = ["granite", "quartz", "marble", "dolomite", "quartzite"];

function customSortType(a: string, b: string) {
  return (
    customOrder.indexOf(a.toLowerCase()) - customOrder.indexOf(b.toLowerCase())
  );
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const stones = await selectMany<Stone>(
    db,
    `
        SELECT id, name, type, url, is_display, height, width, amount
        FROM stones
        WHERE company_id = ? AND is_display = 1
        AND COALESCE(amount, 0) > 0
        ORDER BY name ASC
      `,
    [1]
  );

  return { stones };
};

function InteractiveCard({
  stone,
  setCurrentId,
  stoneType,
}: {
  stone: Stone;
  setCurrentId: (value: number, type: string) => void;
  stoneType: string;
}) {
  const displayedAmount = stone.amount && stone.amount > 0 ? stone.amount : "—";
  const displayedWidth = stone.width && stone.width > 0 ? stone.width : "—";
  const displayedHeight = stone.height && stone.height > 0 ? stone.height : "—";

  return (
    <div
      key={stone.id}
      className="relative group w-full"
      onAuxClick={(e) => {
        if (e.button === 1 && stone.url) {
          e.preventDefault();
          window.open(stone.url, "_blank");
        }
      }}
    >
      <ImageCard
        fieldList={{
          Amount: `${displayedAmount}`,
          Size: `${displayedWidth} x ${displayedHeight}`,
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

  const handleSetCurrentId = (id: number | undefined, type?: string) => {
    setCurrentId(id);
    if (type) {
      setActiveType(type);
    } else if (id === undefined) {
      setActiveType(undefined);
    }
  };

  const stoneList = stones.reduce((acc: { [key: string]: Stone[] }, stone) => {
    if (!acc[stone.type]) {
      acc[stone.type] = [];
    }
    acc[stone.type].push(stone);
    return acc;
  }, {});

  return (
    <Accordion type="single" defaultValue="stones" className="pt-24 sm:pt-0">
      <AccordionItem value="stones">
        <AccordionContent>
          <Accordion type="multiple">
            {Object.keys(stoneList)
              .sort(customSortType)
              .map((type) => (
                <AccordionItem key={type} value={type}>
                  <AccordionTrigger>
                    {capitalizeFirstLetter(type)}
                  </AccordionTrigger>
                  <AccordionContent>
                    <ModuleList>
                      <SuperCarousel
                        currentId={currentId}
                        setCurrentId={handleSetCurrentId}
                        images={stoneList[type]}
                        stoneType={type}
                        activeType={activeType}
                      />
                      {stoneList[type]

                        .sort((a, b) => {
                          const aAmount = a.amount ?? 0;
                          const bAmount = b.amount ?? 0;
                          if (aAmount === 0 && bAmount !== 0) return 1;
                          if (aAmount !== 0 && bAmount === 0) return -1;
                          return a.name.localeCompare(b.name);
                        })
                        .map((stone) => (
                          <InteractiveCard
                            key={stone.id}
                            stone={stone}
                            setCurrentId={handleSetCurrentId}
                            stoneType={type}
                          />
                        ))}
                    </ModuleList>
                  </AccordionContent>
                </AccordionItem>
              ))}
          </Accordion>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
