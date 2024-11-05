import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Accordion,
  AccordionItem,
  AccordionContent,
} from "~/components/ui/accordion";

import { db } from "~/db.server";

import { selectMany } from "~/utils/queryHelpers";

interface Image {
  id: number;
  name: string;
  url: string | null;
}

export const loader = async () => {
  const images = await selectMany<Image>(
    db,
    "select id, name, url from images"
  );
  return json({ images });
};

export default function Images() {
  const { images } = useLoaderData<typeof loader>();

  return (
    <Accordion type="single" defaultValue="images">
      <AccordionItem value="images">
        <AccordionContent>
          <Accordion type="multiple">
            <AccordionContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {images.map((image) => (
                  <div key={image.id} className="flex flex-col items-center">
                    <img
                      src={image.url || undefined}
                      alt={image.name}
                      className="w-full h-auto rounded-lg"
                    />
                    <p className="text-sm text-center mt-2">{image.name}</p>
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
