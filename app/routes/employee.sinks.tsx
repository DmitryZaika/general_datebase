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
import { useArrowToggle } from "~/hooks/useArrowToggle";

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
  const ids = sinks.map((item) => item.id);
  const { currentId, setCurrentId } = useArrowToggle(ids);
  return (
    <Accordion type="single" defaultValue="sinks" className="pt-24 sm:pt-0">
      <AccordionItem value="sinks">
        <AccordionContent>
          <Accordion type="multiple">
            <AccordionContent>
              <ModuleList>
                {sinks
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((sink) => (
                    <Image
                      id={sink.id}
                      key={sink.id}
                      src={sink.url}
                      alt={sink.name}
                      name={sink.name}
                      setImage={setCurrentId}
                      isOpen={currentId === sink.id}
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
