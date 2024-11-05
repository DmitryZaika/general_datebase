import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Accordion,
  AccordionItem,
  AccordionContent,
} from "~/components/ui/accordion";

import { db } from "~/db.server";

import { selectMany } from "~/utils/queryHelpers";

interface Document {
  id: number;
  name: string;
  url: string | null;
}

export const loader = async () => {
  const documents = await selectMany<Document>(
    db,
    "select id, name, url from documents"
  );
  return json({ documents });
};

export default function Documents() {
  const { documents } = useLoaderData<typeof loader>();

  return (
    <Accordion type="single" defaultValue="documents">
      <AccordionItem value="documents">
        <AccordionContent>
          <Accordion type="multiple">
            <AccordionContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {documents.map((document) => (
                  <div key={document.id} className="flex flex-col items-center">
                    <img
                      src={document.url || undefined}
                      alt={document.name}
                      className="w-full h-auto rounded-lg"
                    />
                    <p className="text-sm text-center mt-2">{document.name}</p>
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
