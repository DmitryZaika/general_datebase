//// filepath: c:\Users\sarah\general_datebase\app\routes\admin.stones.tsx
import { LoaderFunctionArgs, redirect, Outlet } from "react-router";
import { useLoaderData, Link } from "react-router";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "~/components/ui/accordion";
import { capitalizeFirstLetter } from "~/utils/words";
import { FaPencilAlt, FaTimes } from "react-icons/fa";
import { selectMany } from "~/utils/queryHelpers";
import { db } from "~/db.server";
import { Button } from "~/components/ui/button";
import { getAdminUser } from "~/utils/session.server";

interface Stone {
  id: number;
  name: string;
  type: string;
  url: string | null;
  is_display: boolean | number;
  height: number | null;
  width: number | null;
  amount: number;
  available: number;
}

const customOrder = ["granite", "quartz", "marble", "dolomite", "quartzite"];

function customSortType(a: string, b: string) {
  return (
    customOrder.indexOf(a.toLowerCase()) - customOrder.indexOf(b.toLowerCase())
  );
}

function getStonePriority(stone: Stone) {
  const hasStock = stone.available > 0;
  const isDisplayed = !!stone.is_display;

  if (isDisplayed && hasStock) return 0;
  if (isDisplayed && !hasStock) return 1;
  if (!isDisplayed && hasStock) return 2;
  return 3;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await getAdminUser(request);
  const stones = await selectMany<Stone>(
    db,
    `
      SELECT 
        s.id,
        s.name,
        s.type,
        s.url,
        s.is_display,
        s.height,
        s.width,
        (SELECT COUNT(*) FROM slab_inventory WHERE stone_id = s.id) AS amount,
        (SELECT COUNT(*) FROM slab_inventory WHERE stone_id = s.id AND is_sold = 0) AS available
      FROM stones s
      WHERE s.company_id = ?
      ORDER BY s.name ASC
    `,
    [user.company_id]
  );

  return { stones };
};

export default function AdminStones() {
  const { stones } = useLoaderData<typeof loader>();

  // Group stones by type
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
                  .sort(customSortType)
                  .map((type) => (
                    <AccordionItem key={type} value={type}>
                      <AccordionTrigger>
                        {capitalizeFirstLetter(type)}
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-3">
                          {stoneList[type]
                            .sort((a, b) => {
                              const priorityA = getStonePriority(a);
                              const priorityB = getStonePriority(b);
                              if (priorityA !== priorityB) {
                                return priorityA - priorityB;
                              }
                              return a.name.localeCompare(b.name);
                            })
                            .map((stone) => {
                              const displayedAmount =
                                stone.amount > 0 ? stone.amount : "—";
                              const displayedAvailable = stone.available;
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
                                      {displayedAmount === "—" && (
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
                                      Available: {displayedAvailable}
                                    </p>
                                    <p className="text-center text-sm">
                                      Size: {displayedWidth} x {displayedHeight}
                                    </p>
                                  </div>

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
