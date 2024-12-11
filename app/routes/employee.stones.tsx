import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "~/components/ui/accordion";
import { capitalizeFirstLetter } from "~/utils/words";
import { LoaderFunctionArgs, redirect } from "@remix-run/node";
import { selectMany } from "~/utils/queryHelpers";
import { db } from "~/db.server";
import { useLoaderData } from "@remix-run/react";
import { Image } from "~/components/molecules/Image";
import ModuleList from "~/components/ModuleList";
import { getEmployeeUser } from "~/utils/session.server";

interface Stone {
  id: number;
  name: string;
  type: string;
  url: string | null;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getEmployeeUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  const stones = await selectMany<Stone>(
    db,
    "select id, name, type, url from stones"
  );
  return {
    stones,
  };
};

export default function Stones() {
  const { stones } = useLoaderData<typeof loader>();
  const stoneList = stones.reduce(
    (acc: { [key: string]: Stone[] }, stone: Stone) => {
      if (!acc[stone.type]) {
        acc[stone.type] = [];
      }
      acc[stone.type].push(stone);
      return acc;
    },
    {}
  );

  return (
    <Accordion type="single" defaultValue="stones">
      <AccordionItem value="stones">
        <AccordionContent>
          <Accordion type="multiple">
            {Object.keys(stoneList).map((type) => (
              <AccordionItem key={type} value={type}>
                <AccordionTrigger>
                  {capitalizeFirstLetter(type)}
                </AccordionTrigger>
                <AccordionContent>
                  <ModuleList>
                    {stoneList[type].map((stone) => (
                      <div key={stone.id} className=" font-bold items-center">
                        <Image
                          src={stone.url}
                          alt={stone.name}
                          name={stone.name}
                        />
                      </div>
                    ))}
                  </ModuleList>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
