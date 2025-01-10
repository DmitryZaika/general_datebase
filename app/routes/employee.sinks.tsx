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

interface Sink {
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
  const sinks = await selectMany<Sink>(
    db,
    "SELECT id, name, url FROM sinks WHERE company_id = ?",
    [user.company_id]
  );
  return { sinks };
};

export default function Sinks() {
  const { sinks } = useLoaderData<typeof loader>();

  return (
    <Accordion type="single" defaultValue="sinks">
      <AccordionItem value="sinks">
        <AccordionContent>
          <Accordion type="multiple">
            <AccordionContent>
              <ModuleList>
                {sinks.map((sink) => (
                  <Image
                    key={sink.id}
                    src={sink.url}
                    alt={sink.name}
                    name={sink.name}
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
