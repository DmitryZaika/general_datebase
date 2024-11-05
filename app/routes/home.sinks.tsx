import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Accordion,
  AccordionItem,
  AccordionContent,
} from "~/components/ui/accordion";

import { db } from "~/db.server";

import { selectMany } from "~/utils/queryHelpers";

interface Sink {
  id: number;
  name: string;
  url: string | null;
}

export const loader = async () => {
  const sinks = await selectMany<Sink>(db, "select id, name, url from sinks");
  return json({ sinks });
};

export default function Sinks() {
  const { sinks } = useLoaderData<typeof loader>();

  return (
    <Accordion type="single" defaultValue="sinks">
      <AccordionItem value="sinks">
        <AccordionContent>
          <Accordion type="multiple">
            <AccordionContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {sinks.map((sink) => (
                  <div key={sink.id} className="flex flex-col items-center">
                    <img
                      src={sink.url || undefined}
                      alt={sink.name}
                      className="w-full h-auto rounded-lg"
                    />
                    <p className="text-sm text-center mt-2">{sink.name}</p>
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
