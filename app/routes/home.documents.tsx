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

interface DocumentProps {
  src: string;
  name: string;
}

interface TDocument {
  id: number;
  name: string;
  src?: string;
}

export const loader = async () => {
  const documents = await selectMany<TDocument>(
    db,
    "SELECT id, name FROM documents"
  );

  return json({
    documents,
  });
};

function Document({ src, name }: DocumentProps) {
  return (
    <a href={src} target="_blank" rel="noreferrer">
      <Card className="text-center">
        <CardHeader>
          <CardTitle>{name}</CardTitle>
        </CardHeader>
        <CardContent>
          <img src={src} alt={name} className="w-full h-auto rounded" />
        </CardContent>
      </Card>
    </a>
  );
}

export default function Documents() {
  const { documents } = useLoaderData<typeof loader>();
  return (
    <Accordion type="single">
      <AccordionItem value="documents">
        <AccordionTrigger>Documents</AccordionTrigger>
        <AccordionContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {documents.map((item) => (
              <Document
                key={item.id}
                src={getSourceName("documents", item.name)}
                name={item.name}
              />
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
