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
              {documents.map((document) => (
                <ModuleList key={document.id}>
                  <Image
                    src={document.url}
                    alt={document.name}
                    name={document.name}
                  />
                </ModuleList>
              ))}
            </AccordionContent>
          </Accordion>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
