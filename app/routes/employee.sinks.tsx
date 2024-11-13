import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Accordion,
  AccordionItem,
  AccordionContent,
} from "~/components/ui/accordion";
import { Image } from "~/components/molecules/Image";
import { db } from "~/db.server";

import { selectMany } from "~/utils/queryHelpers";
import ModuleList from "~/components/ModuleList";

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
              {sinks.map((sink) => (
                <ModuleList key={sink.id}>
                  <Image src={sink.url} alt={sink.name} name={sink.name} />
                </ModuleList>
              ))}
            </AccordionContent>
          </Accordion>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
