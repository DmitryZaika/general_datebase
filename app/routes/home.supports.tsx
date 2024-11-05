import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Accordion,
  AccordionItem,
  AccordionContent,
} from "~/components/ui/accordion";

import { db } from "~/db.server";

import { selectMany } from "~/utils/queryHelpers";

interface Support {
  id: number;
  name: string;
  url: string | null;
}

export const loader = async () => {
  const supports = await selectMany<Support>(
    db,
    "select id, name, url from supports"
  );
  return json({ supports });
};

export default function Supports() {
  const { supports } = useLoaderData<typeof loader>();

  return (
    <Accordion type="single" defaultValue="supports">
      <AccordionItem value="supports">
        <AccordionContent>
          <Accordion type="multiple">
            <AccordionContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {supports.map((support) => (
                  <div key={support.id} className="flex flex-col items-center">
                    <img
                      src={support.url || undefined}
                      alt={support.name}
                      className="w-full h-auto rounded-lg"
                    />
                    <p className="text-sm text-center mt-2">{support.name}</p>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </Accordion>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
