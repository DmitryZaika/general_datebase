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
  const user = await getEmployeeUser(request);
  const supports = await selectMany<Support>(
    db,
    "select id, name, url from supports WHERE company_id = ?",
    [user.company_id]
  );
  return { supports };
};

export default function Supports() {
  const { supports } = useLoaderData<typeof loader>();
  const ids = supports.map((item) => item.id);
  const { currentId, setCurrentId } = useArrowToggle(ids);
  return (
    <Accordion type="single" defaultValue="supports" className="pt-24 sm:pt-0">
      <AccordionItem value="supports">
        <AccordionContent>
          <Accordion type="multiple">
            <AccordionContent>
              <ModuleList>
                {supports.map((support) => (
                  <Image
                    id={support.id}
                    key={support.id}
                    src={support.url}
                    alt={support.name}
                    name={support.name}
                    setImage={setCurrentId}
                    isOpen={currentId === support.id}
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
