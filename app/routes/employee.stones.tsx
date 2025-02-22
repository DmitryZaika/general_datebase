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
import ModuleList from "~/components/ModuleList";
import { getEmployeeUser } from "~/utils/session.server";
import { useArrowToggle } from "~/hooks/useArrowToggle";
import { ImageCard } from "~/components/organisms/ImageCard";
import { ChildrenImagesDialog } from "~/components/organisms/ChildrenImagesDialog";

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
      ORDER BY name ASC, (amount = 0), amount ASC
    `,
    [user.company_id]
  );

  return { stones };
};

function amountSort(a: Stone, b: Stone) {
  if ((a.amount ?? 0) === 0 && (b.amount ?? 0) !== 0) return 1;
  if ((a.amount ?? 0) !== 0 && (b.amount ?? 0) === 0) return -1;
  return a.name.localeCompare(b.name);
}

function stoneIds(stones: Stone[], stoneId: number): number[] {
  const stoneType = stones.find((item) => item.id === stoneId)?.type;
  if (!stoneType) return [];
  return stones
    .filter((item) => item.type === stoneType)
    .sort(amountSort)
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
                      {stoneList[type].sort(amountSort).map((stone) => (
                        <div
                          key={stone.id}
                          className="relative group w-full"
                          onAuxClick={(e) => {
                            if (e.button === 1 && stone.url) {
                              e.preventDefault();
                              window.open(stone.url, "_blank");
                            }
                          }}
                        >
                          <ImageCard
                            fieldList={{
                              Amount: `${stone.amount || "—"}`,
                              Size: `${stone.width || "—"} x  ${
                                stone.height || "—"
                              }`,
                            }}
                            title={stone.name}
                          >
                            {stone.amount === 0 && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="bg-red-500 text-white text-lg font-bold px-2 py-1 transform z-10 rotate-45 select-none">
                                  Out of Stock
                                </div>
                              </div>
                            )}
                            <ChildrenImagesDialog
                              id={stone.id}
                              src={stone.url}
                              alt={stone.name}
                              setImage={setCurrentId}
                              isOpen={currentId === stone.id}
                            />
                          </ImageCard>
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
