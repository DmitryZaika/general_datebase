import { LoaderFunctionArgs, redirect } from "react-router";
import { useLoaderData } from "react-router";
import {
  Accordion,
  AccordionItem,
  AccordionContent,
} from "~/components/ui/accordion";
import { Image } from "~/components/molecules/Image";
import { db } from "~/db.server";

import { selectMany } from "~/utils/queryHelpers";
import ModuleList from "~/components/ModuleList";
import { getEmployeeUser } from "~/utils/session.server";
import { useEffect, useState } from "react";
import { useArrowToggle } from "~/hooks/useArrowToggle";

interface Image {
  id: number;
  name: string;
  url: string | null;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getEmployeeUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  const user = await getEmployeeUser(request);
  const images = await selectMany<Image>(
    db,
    "SELECT id, name, url FROM images WHERE company_id = ?",
    [user.company_id]
  );
  return { images };
};

export default function Images() {
  const { images } = useLoaderData<typeof loader>();
  const ids = images.map((item) => item.id);
  const { currentId, setCurrentId } = useArrowToggle(ids);

  return (
    <Accordion type="single" defaultValue="images" className="pt-24 sm:pt-0">
      <AccordionItem value="images">
        <AccordionContent>
          <Accordion type="multiple">
            <AccordionContent>
              <ModuleList>
                {images
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((image) => (
                    <Image
                      id={image.id}
                      key={image.id}
                      src={image.url}
                      alt={image.name}
                      name={image.name}
                      setImage={setCurrentId}
                      isOpen={currentId === image.id}
                    />
                  ))}
              </ModuleList>
            </AccordionContent>
          </Accordion>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
