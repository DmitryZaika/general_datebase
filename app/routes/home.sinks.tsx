import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "~/components/ui/accordion";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { db } from "~/db.server";
import { getSourceName } from "~/utils/image";
import { selectMany } from "~/utils/queryHelpers";
import { capitalizeFirstLetter } from "~/utils/words";

interface Sink {
  id: number;
  name: string;
}

export const loader = async () => {
  const sinks = await selectMany<Sink>(db, "select id, name from sinks");
  return json({ sinks });
};

export default function Sinks() {
  const { sinks } = useLoaderData<typeof loader>();
  return (
    <Accordion type="single">
      <AccordionItem value="sinks">
        <AccordionTrigger>Sinks</AccordionTrigger>
        <AccordionContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {sinks.map((item) => (
              <Card key={item.id}>
                <CardHeader>
                  <CardTitle>{capitalizeFirstLetter(item.name)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <img
                    src={getSourceName("sinks", item.name)}
                    alt={item.name}
                    className="w-full h-auto rounded"
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
