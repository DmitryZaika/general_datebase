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

interface Support {
  id: number;
  name: string;
}
export const loader = async () => {
  const supports = await selectMany<Support>(
    db,
    "select id, name from supports"
  );

  return json({ supports });
};

export default function Supports() {
  const { supports } = useLoaderData<typeof loader>();
  return (
    <Accordion type="single" defaultValue="supports">
      <AccordionItem value="supports">
        <AccordionTrigger>Supports</AccordionTrigger>
        <AccordionContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {supports.map((item) => (
              <Card key={item.id}>
                <CardHeader>
                  <CardTitle>{item.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <img
                    src={getSourceName("supports", item.name)}
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
