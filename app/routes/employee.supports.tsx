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

interface Support {
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
  const supports = await selectMany<Support>(
    db,
    "select id, name, url from supports"
  );
  return json({ supports });
};

export default function Supports() {
  const { supports } = useLoaderData<typeof loader>();

  return (
    <Accordion type="single" defaultValue="supports">
      <AccordionItem value="supports">
        <AccordionContent>
          <Accordion type="multiple">
            <AccordionContent>
              {supports.map((support) => (
                <ModuleList key={support.id}>
                  <Image
                    src={support.url}
                    alt={support.name}
                    name={support.name}
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
