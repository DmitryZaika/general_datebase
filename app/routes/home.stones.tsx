import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "~/components/ui/accordion";
import { capitalizeFirstLetter } from "~/utils/words";
import { getSourceName } from "~/utils/image";
import { json } from "@remix-run/node";
import { selectMany } from "~/utils/queryHelpers";
import { db } from "~/db.server";
import { useLoaderData } from "@remix-run/react";

interface Stone {
  id: number;
  name: string;
  type: string;
  url: string | null;
}

export const loader = async () => {
  const stones = await selectMany<Stone>(
    db,
    "select id, name, type, url from stones"
  );
  return json({
    stones,
  });
};

export default function Stones() {
  const { stones } = useLoaderData<typeof loader>();
  const stoneList = stones.reduce(
    (acc: { [key: string]: Stone[] }, stone: Stone) => {
      if (!acc[stone.type]) {
        acc[stone.type] = [];
      }
      acc[stone.type].push(stone);
      return acc;
    },
    {}
  );

  return (
    <Accordion type="single" defaultValue="stones">
      <AccordionItem value="stones">
        <AccordionTrigger>Stones</AccordionTrigger>
        <AccordionContent>
          <Accordion type="multiple">
            {Object.keys(stoneList).map((type) => (
              <AccordionItem key={type} value={type}>
                <AccordionTrigger>
                  {capitalizeFirstLetter(type)}
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {stoneList[type].map((stone) => (
                      <div
                        key={stone.id}
                        className="flex flex-col items-center"
                      >
                        <img
                          src={stone.url || undefined}
                          alt={stone.name}
                          className="w-full h-auto rounded-lg"
                        />
                        <p className="text-sm text-center mt-2">{stone.name}</p>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
