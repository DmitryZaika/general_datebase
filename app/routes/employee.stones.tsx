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
  amount: number | null;
}

const customOrder = ["granite", "quartz", "marble", "dolomite", "quartzite"];
function customSort(a: string, b: string) {
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
      SELECT id, name, type, url, is_display, height, width, amount
      FROM stones
      WHERE company_id = ? AND is_display = 1
      ORDER BY name ASC, (amount = 0), amount ASC
    `,
    [user.company_id]
  );

  return { stones };
};

function InteractiveCard({
  stone,
  setCurrentId,
}: {
  stone: Stone;
  setCurrentId: (value: number) => void;
}) {
  return (
    <div
      key={stone.id}
      className={`relative group w-full ${
        (stone.amount ?? 0) === 0 ? "opacity-50" : ""
      }`}
      onAuxClick={(e) => {
        if (e.button === 1 && stone.url) {
          e.preventDefault();
          window.open(stone.url, "_blank");
        }
      }}
    >
      <ImageCard
        fieldList={{
          Amount: `${stone.amount || "—"}`,
          Size: `${stone.width || "—"} x  ${stone.height || "—"}`,
        }}
        title={stone.name}
      >
        <img
          src={stone.url || "/path/to/placeholder.png"}
          alt={stone.name || "Image"}
          className="object-cover w-40 h-40 border-2 border-blue-500 rounded cursor-pointer transition duration-200 ease-in-out transform hover:scale-[105%] hover:shadow-lg select-none hover:border-blue-500 hover:bg-gray-300"
          loading="lazy"
          onClick={() => setCurrentId(stone.id)}
        />
      </ImageCard>
      {stone.name && (
        <p className="text-center font-bold font-sans">{stone.name}</p>
      )}
    </div>
  );
}

export default function Stones() {
  const { stones } = useLoaderData<typeof loader>();
  const [currentId, setCurrentId] = useState<number | undefined>(undefined);

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
              .sort(customSort)
              .map((type) => (
                <AccordionItem key={type} value={type}>
                  <AccordionTrigger>
                    {capitalizeFirstLetter(type)}
                  </AccordionTrigger>
                  <AccordionContent>
                    <ModuleList>
                      <SuperCarousel
                        currentId={currentId}
                        setCurrentId={setCurrentId}
                        images={stoneList[type]}
                      />
                      {stoneList[type].map((stone) => (
                        <InteractiveCard
                          key={stone.id}
                          stone={stone}
                          setCurrentId={setCurrentId}
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
