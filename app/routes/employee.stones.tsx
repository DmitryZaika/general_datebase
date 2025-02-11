// app/routes/stones.tsx (пример вашего файла)

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
import { useArrowToggle } from "~/hooks/useArrowToggle";

interface Stone {
  id: number;
  name: string;
  type: string;
  url: string | null;
  is_display: boolean | number;
  height: number | null;
  width: number | null;
  amount: number | null;
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
    `
      SELECT id, name, type, url, is_display, height, width, amount
      FROM stones
      WHERE company_id = ? AND is_display = 1
    `,
    [user.company_id]
  );

  return { stones };
};

function stoneIds(stones: Stone[], stoneId: number): number[] {
  const stoneType = stones.find((item) => item.id === stoneId)?.type;
  return stones
    .filter((item) => item.type === stoneType)
    .map((item) => item.id);
}

export default function Stones() {
  const { stones } = useLoaderData<typeof loader>();
  const { currentId, setCurrentId } = useArrowToggle(
    (value: number | undefined) => (value ? stoneIds(stones, value) : [])
  );

  const stoneList = stones.reduce((acc: { [key: string]: Stone[] }, stone) => {
    if (!acc[stone.type]) {
      acc[stone.type] = [];
    }
    acc[stone.type].push(stone);
    return acc;
  }, {});

  return (
    <Accordion type="single" defaultValue="stones" className="pt-24 sm:pt-0">
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
                        <div key={stone.id} className="relative group w-full">
                          <Image
                            id={stone.id}
                            src={stone.url}
                            alt={stone.name}
                            name={stone.name}
                            setImage={setCurrentId}
                            isOpen={currentId === stone.id}
                          />
                          <div
                            className="absolute bottom-6 left-0 w-full p-2 
                                          opacity-0 group-hover:opacity-100 
                                          transition-opacity duration-300
                                          bg-gray-800 bg-opacity-70 
                                          text-white text-xs rounded-t"
                          >
                            <p>
                              <strong>Amount:</strong> {stone.amount ?? "—"}
                            </p>
                            <p>
                              <strong>Size:</strong> {stone.width ?? "—"} x{" "}
                              {stone.height ?? "—"}
                            </p>
                          </div>
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
