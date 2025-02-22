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
import { useLoaderData, Link, Outlet } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { FaPencilAlt, FaTimes } from "react-icons/fa";
import { Image } from "~/components/molecules/Image";
import { getAdminUser } from "~/utils/session.server";
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
    await getAdminUser(request);
  } catch (error) {
    return redirect(`/login?error=${encodeURIComponent(String(error))}`);
  }
  const user = await getAdminUser(request);

  const stones = await selectMany<Stone>(
    db,
    `SELECT id, name, type, url, is_display, height, width, amount
       FROM stones
      WHERE company_id = ?
      ORDER BY name ASC`,
    [user.company_id]
  );

  return { stones };
};

function stoneIds(stones: Stone[], stoneId: number): number[] {
  const stoneType = stones.find((item) => item.id === stoneId)?.type;
  if (!stoneType) return [];
  return stones
    .filter((item) => item.type === stoneType)
    .sort((a, b) => {
      if ((a.amount ?? 0) === 0 && (b.amount ?? 0) !== 0) return 1;
      if ((a.amount ?? 0) !== 0 && (b.amount ?? 0) === 0) return -1;
      return a.name.localeCompare(b.name);
    })
    .map((item) => item.id);
}

export default function AdminStones() {
  const { stones } = useLoaderData<typeof loader>();

  const { currentId, setCurrentId } = useArrowToggle(
    (value: number | undefined) => (value ? [value] : [])
  );

  // Группируем камни по типу
  const stoneList = stones.reduce((acc: { [key: string]: Stone[] }, stone) => {
    if (!acc[stone.type]) {
      acc[stone.type] = [];
    }
    acc[stone.type].push(stone);
    return acc;
  }, {});

  return (
    <>
      <Link to={`add`} relative="path">
        <Button>Add Stone</Button>
      </Link>
      <div className="pt-24 sm:pt-0">
        <Accordion type="single" defaultValue="stones" className="w-full">
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
                        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-3">
                          {stoneList[type]
                            .sort((a, b) => {
                              // Формируем оценки для сортировки:
                              // Группа 0: в наличии и отображается (amount !== 0, is_display true)
                              // Группа 1: отсутствует, но отображается (amount === 0, is_display true)
                              // Группа 2: в наличии, но !is_display (amount !== 0, is_display false)
                              // Группа 3: отсутствует и !is_display (amount === 0, is_display false)
                              const scoreA =
                                (a.amount === 0 ? 1 : 0) +
                                (a.is_display ? 0 : 2);
                              const scoreB =
                                (b.amount === 0 ? 1 : 0) +
                                (b.is_display ? 0 : 2);
                              if (scoreA !== scoreB) return scoreA - scoreB;
                              return a.name.localeCompare(b.name);
                            })
                            .map((stone) => {
                              return (
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
                                  <div
                                    className={`${
                                      !stone.is_display ? "opacity-30" : ""
                                    }`}
                                  >
                                    <Image
                                      id={stone.id}
                                      src={stone.url}
                                      alt={stone.name}
                                      className="w-full h-12 object-cover rounded"
                                      isOpen={currentId === stone.id}
                                      setImage={setCurrentId}
                                    />
                                  </div>
                                  <div className="absolute bottom- left-0 w-full p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gray-800 bg-opacity-70 text-white text-xs rounded">
                                    <p>
                                      <strong>Amount:</strong>{" "}
                                      {stone.amount ?? "—"}
                                    </p>
                                    <p>
                                      <strong>Size:</strong>{" "}
                                      {stone.width ?? "—"} x{" "}
                                      {stone.height ?? "—"}
                                    </p>
                                  </div>
                                  <div className="absolute inset-0 flex justify-between items-start p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                    <Link
                                      to={`edit/${stone.id}`}
                                      className="text-white z-10 bg-gray-800 bg-opacity-60 rounded-full p-2 hover:bg-opacity-80 transition"
                                      title="Edit Stone"
                                      aria-label={`Edit ${stone.name}`}
                                    >
                                      <FaPencilAlt />
                                    </Link>
                                    <Link
                                      to={`delete/${stone.id}`}
                                      className="text-white bg-gray-800 bg-opacity-60 rounded-full p-2 hover:bg-opacity-80 transition"
                                      title="Delete Stone"
                                      aria-label={`Delete ${stone.name}`}
                                    >
                                      <FaTimes />
                                    </Link>
                                  </div>
                                  {stone.amount === 0 && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      <div className="bg-red-500 text-white text-lg font-bold px-2 py-1 transform z-10 rotate-45">
                                        Out of Stock
                                      </div>
                                    </div>
                                  )}
                                  <div className="mt-2 text-center">
                                    <h3 className="text-lg font-semibold">
                                      {stone.name}
                                    </h3>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
              </Accordion>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <Outlet />
      </div>
    </>
  );
}
