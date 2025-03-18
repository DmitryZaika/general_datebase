// app/routes/employee.stones.tsx
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "~/components/ui/accordion";
import { capitalizeFirstLetter } from "~/utils/words";
import { LoaderFunctionArgs, redirect, Outlet } from "react-router";
import { selectMany } from "~/utils/queryHelpers";
import { db } from "~/db.server";
import { useLoaderData } from "react-router";
import ModuleList from "~/components/ModuleList";
import { getEmployeeUser } from "~/utils/session.server";
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
  amount: number;
  available: number;
  created_date: string;
  on_sale: boolean;
}

const customOrder = ["granite", "quartz", "marble", "dolomite", "quartzite"];

function customSortType(a: string, b: string) {
  return (
    customOrder.indexOf(a.toLowerCase()) - customOrder.indexOf(b.toLowerCase())
  );
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getEmployeeUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  const user = await getEmployeeUser(request);

  const stones = await selectMany<Stone>(
    db,
    `
    SELECT 
      s.id, 
      s.name, 
      s.type, 
      s.url, 
      s.is_display, 
      s.height, 
      s.width, 
      (SELECT COUNT(*) FROM slab_inventory WHERE stone_id = s.id) AS amount,
       (SELECT COUNT(*) FROM slab_inventory WHERE stone_id = s.id AND is_sold = 0) AS available,
      s.created_date, 
      s.on_sale
    FROM stones s
    WHERE s.company_id = ? AND s.is_display = 1
    ORDER BY s.name ASC
    `,
    [user.company_id]
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
  const displayedAmount = stone.amount > 0 ? stone.amount : "—";
  const displayedWidth = stone.width && stone.width > 0 ? stone.width : "—";
  const displayedHeight = stone.height && stone.height > 0 ? stone.height : "—";
  const createdDate = new Date(stone.created_date);
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const isNew = createdDate > oneWeekAgo;
  const isOnSale = !!stone.on_sale;

  return (
    <div
      key={stone.id}
      className="relative group w-full overflow-hidden"
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
          Avaliable: `${stone.available}`,
          Amount: `${displayedAmount}`,
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
    <>
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
                          type="stones"
                          currentId={currentId}
                          setCurrentId={handleSetCurrentId}
                          images={stoneList[type]}
                          category={type}
                          activeType={activeType}
                        />
                        {stoneList[type]
                          .sort((a, b) => {
                            const aAvailable = a.available ?? 0;
                            const bAvailable = b.available ?? 0;
                            if (aAvailable > 0 && bAvailable === 0) return -1;
                            if (aAvailable === 0 && bAvailable > 0) return 1;

                            const aAmount = a.amount ?? 0;
                            const bAmount = b.amount ?? 0;
                            if (aAmount > bAmount) return -1;
                            if (aAmount < bAmount) return 1;

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
      <Outlet />
    </>
  );
}
