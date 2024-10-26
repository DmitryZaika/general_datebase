import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "~/components/ui/accordion";
import { getSourceName } from "~/utils/image";
import { Image } from "~/components/molecules/Image";
import { selectMany } from "~/utils/queryHelpers";
import { json } from "@remix-run/node";
import { db } from "~/db.server";
import { useLoaderData } from "@remix-run/react";

interface ImageData {
  id: number;
  name: string;
}

export const loader = async () => {
  const images = await selectMany<ImageData>(db, "SELECT id, name FROM images");

  return json({
    images,
  });
};

export default function Images() {
  const { images } = useLoaderData<typeof loader>();
  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="images">
        <AccordionTrigger>Images</AccordionTrigger>
        <AccordionContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {images.map((image) => (
              <Image
                key={image.id}
                src={getSourceName("images", image.name)}
                name={image.name}
              />
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
