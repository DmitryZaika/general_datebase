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

const customOrder = ["granite", "quartz", "marble", "dolomite", "quartzite"];
function customSort(a: string, b: string) {
  return (
    customOrder.indexOf(a.toLowerCase()) - customOrder.indexOf(b.toLowerCase())
  );
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getEmployeeUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  const user = await getEmployeeUser(request);
  const stones = await selectMany<Stone>(
    db,
    "SELECT id, name, type, url FROM stones WHERE company_id = ?",
    [user.company_id]
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

  console.log(Object.keys(stoneList));
  console.log(Object.keys(stoneList).sort(customSort));

  return (
    <Accordion type="single" defaultValue="stones">
      <AccordionItem value="stones">
        <AccordionContent>
          <Accordion type="multiple">
            {Object.keys(stoneList)
              .sort(customSort)
              .map((type) => (
                <AccordionItem key={type} value={type}>
                  <AccordionTrigger>
                    {capitalizeFirstLetter(type)}
                  </AccordionTrigger>
                  <AccordionContent>
                    <ModuleList>
                      {stoneList[type].map((stone) => (
                        <Image
                          key={stone.id}
                          src={stone.url}
                          alt={stone.name}
                          name={stone.name}
                        />
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
