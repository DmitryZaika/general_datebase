import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "~/components/ui/accordion";
import { capitalizeFirstLetter } from "~/utils/words";
import { LoaderFunctionArgs, redirect } from "react-router";
import { selectMany } from "~/utils/queryHelpers";
import { db } from "~/db.server";
import { useLoaderData, Link, Outlet } from "react-router";
import { Button } from "~/components/ui/button";
import { FaPencilAlt, FaTimes } from "react-icons/fa";
import { getAdminUser } from "~/utils/session.server";

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
    `
      SELECT id, name, type, url, is_display, height, width, amount
      FROM stones
      WHERE company_id = ?
      ORDER BY name ASC
    `,
    [user.company_id]
  );

  return { stones };
};

export default function AdminStones() {
  const { stones } = useLoaderData<typeof loader>();

  const stoneList = stones.reduce((acc: Record<string, Stone[]>, stone) => {
    if (!acc[stone.type]) {
      acc[stone.type] = [];
    }
    acc[stone.type].push(stone);
    return acc;
  }, {});

  return (
    <>
      <Link to="add">
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
                            // Sort so that out-of-stock and non-displayed items go last
                            .sort((a, b) => {
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
                              const displayedAmount =
                                stone.amount && stone.amount > 0
                                  ? stone.amount
                                  : "—";
                              const displayedWidth =
                                stone.width && stone.width > 0
                                  ? stone.width
                                  : "—";
                              const displayedHeight =
                                stone.height && stone.height > 0
                                  ? stone.height
                                  : "—";

                              return (
                                <div key={stone.id} className="relative w-full">
                                  {/* Dim the card if it's hidden (is_display=0) */}
                                  <div
                                    className={`border-2 border-blue-500 rounded p-2 ${
                                      !stone.is_display ? "opacity-30" : ""
                                    }`}
                                  >
                                    <div className="relative">
                                      <img
                                        src={stone.url || "/placeholder.png"}
                                        alt={stone.name || "Stone Image"}
                                        className="object-cover w-full h-40 rounded select-none"
                                        loading="lazy"
                                      />
                                      {stone.amount === 0 && (
                                        <div className="absolute top-15 left-1/2 transform -translate-x-1/2 flex items-center justify-center whitespace-nowrap">
                                          <div className="bg-red-500 text-white text-lg font-bold px-2 py-1 transform z-10 rotate-45 select-none">
                                            Out of Stock
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    <p className="text-center font-bold mt-2">
                                      {stone.name}
                                    </p>
                                    <p className="text-center text-sm">
                                      Amount: {displayedAmount}
                                    </p>
                                    <p className="text-center text-sm">
                                      Size: {displayedWidth} x {displayedHeight}
                                    </p>
                                  </div>

                                  {/* Edit & Delete icons always visible */}
                                  <div className="absolute inset-0 flex justify-between items-start p-2 opacity-50 transition-opacity duration-300">
                                    <Link
                                      to={`edit/${stone.id}`}
                                      className="text-white bg-gray-800 bg-opacity-60 rounded-full p-2"
                                      title="Edit Stone"
                                      aria-label={`Edit ${stone.name}`}
                                    >
                                      <FaPencilAlt />
                                    </Link>
                                    <Link
                                      to={`delete/${stone.id}`}
                                      className="text-white bg-gray-800 bg-opacity-60 rounded-full p-2"
                                      title="Delete Stone"
                                      aria-label={`Delete ${stone.name}`}
                                    >
                                      <FaTimes />
                                    </Link>
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
