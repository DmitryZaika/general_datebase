import { LoaderFunctionArgs, redirect } from "@remix-run/node";
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
import { useEffect, useState } from "react";

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
  const [openImage, setOpenImage] = useState<undefined | number>(undefined);
  const ids = images.map((item) => item.id);

  const rightHandler = (event) => {
    console.log(openImage);
    if (!openImage) return;
    console.log("CLICKED");
    console.log(event.key);
    if (event.key === "ArrowLeft") {
      const index = ids.indexOf(openImage);
      console.log(index);
      setOpenImage(ids[index - 1]);
    } else if (event.key === "ArrowRight") {
      const index = ids.indexOf(openImage);
      setOpenImage(ids[index + 1]);
    }
  };

  useEffect(() => {
    window.addEventListener("keydown", rightHandler);
    return () => {
      window.removeEventListener("keydown", rightHandler);
    };
  }, [openImage]);

  return (
    <Accordion type="single" defaultValue="images" className="pt-24 sm:pt-0">
      <AccordionItem value="images">
        <AccordionContent>
          <Accordion type="multiple">
            <AccordionContent>
              <ModuleList>
                {images.map((image) => (
                  <Image
                    id={image.id}
                    key={image.id}
                    src={image.url}
                    alt={image.name}
                    name={image.name}
                    setImage={setOpenImage}
                    isOpen={openImage === image.id}
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
