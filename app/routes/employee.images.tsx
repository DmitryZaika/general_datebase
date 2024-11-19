import { json, LoaderFunctionArgs, redirect } from "@remix-run/node";
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
import { getEmployeeUser } from "~/utils/session.server";

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
              {images.map((image) => (
                <ModuleList key={image.id}>
                  <Image src={image.url} alt={image.name} name={image.name} />
                </ModuleList>
              ))}
            </AccordionContent>
          </Accordion>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
