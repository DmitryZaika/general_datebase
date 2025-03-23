// app/routes/admin.sinks.tsx

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

interface Sink {
  id: number;
  name: string;
  type: string;
  url: string | null;
  is_display: boolean | number;
  amount: number | null;
  width: number | null;
  height: number | null;
}

const customOrder = [
  "stainless 18 gauge",
  "stainless 16 gauge",
  "granite composite",
  "ceramic",
  "farm house",
];

function customSort(a: string, b: string) {
  const aIndex = customOrder.findIndex(
    (item) => item.toLowerCase() === a.toLowerCase(),
  );
  const bIndex = customOrder.findIndex(
    (item) => item.toLowerCase() === b.toLowerCase(),
  );

  if (aIndex !== -1 && bIndex !== -1) {
    return aIndex - bIndex;
  }
  if (aIndex !== -1 && bIndex === -1) {
    return -1;
  }
  if (aIndex === -1 && bIndex !== -1) {
    return 1;
  }

  // Если ни один из них не входит в customOrder,
  // сортируем по алфавиту
  return a.localeCompare(b);
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getAdminUser(request);
  } catch (error) {
    return redirect(`/login?error=${encodeURIComponent(String(error))}`);
  }

  const user = await getAdminUser(request);
  const sinks = await selectMany<Sink>(
    db,
    `
      SELECT
        id,
        name,
        type,
        url,
        is_display,
        amount,
        width,
        height
      FROM sinks
      WHERE company_id = ?
      ORDER BY name ASC
    `,
    [user.company_id],
  );

  return { sinks };
};

export default function AdminSinks() {
  const { sinks } = useLoaderData<typeof loader>();

  // Группируем по типу (type)
  const sinkList = sinks.reduce<Record<string, Sink[]>>((acc, sink) => {
    if (!acc[sink.type]) {
      acc[sink.type] = [];
    }
    acc[sink.type].push(sink);
    return acc;
  }, {});

  // Сортируем ключи (типы) с помощью customSort
  const sortedTypes = Object.keys(sinkList).sort(customSort);

  return (
    <>
      <Link to="add">
        <Button>Add Sink</Button>
      </Link>

      <div className="pt-24 sm:pt-0">
        <Accordion type="single" defaultValue="sinks" className="w-full">
          <AccordionItem value="sinks">
            <AccordionContent>
              <Accordion type="multiple">
                {sortedTypes.map((type) => (
                  <AccordionItem key={type} value={type}>
                    <AccordionTrigger>
                      {capitalizeFirstLetter(type)}
                    </AccordionTrigger>

                    <AccordionContent>
                      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-3">
                        {sinkList[type]

                          .sort((a, b) => {
                            const scoreA =
                              (a.amount === 0 ? 1 : 0) + (a.is_display ? 0 : 2);
                            const scoreB =
                              (b.amount === 0 ? 1 : 0) + (b.is_display ? 0 : 2);
                            if (scoreA !== scoreB) return scoreA - scoreB;
                            return a.name.localeCompare(b.name);
                          })
                          .map((sink) => {
                            const displayedAmount =
                              sink.amount && sink.amount > 0
                                ? sink.amount
                                : "—";
                            const displayedWidth =
                              sink.width && sink.width > 0 ? sink.width : "—";
                            const displayedHeight =
                              sink.height && sink.height > 0
                                ? sink.height
                                : "—";

                            return (
                              <div key={sink.id} className="relative w-full">
                                <div
                                  className={`border-2 border-blue-500 rounded p-2 ${
                                    !sink.is_display ? "opacity-30" : ""
                                  }`}
                                >
                                  <div className="relative">
                                    <img
                                      src={sink.url || "/placeholder.png"}
                                      alt={sink.name || "Sink Image"}
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
                                    {sink.name}
                                  </p>
                                  <p className="text-center text-sm">
                                    Amount: {displayedAmount}
                                  </p>
                                  <p className="text-center text-sm">
                                    Size: {displayedWidth} x {displayedHeight}
                                  </p>
                                </div>

                                <div className="absolute inset-0 flex justify-between items-start p-2 opacity-50">
                                  <Link
                                    to={`edit/${sink.id}`}
                                    className="text-white bg-gray-800 bg-opacity-60 rounded-full p-2 hover:bg-opacity-80 transition"
                                    title="Edit Sink"
                                    aria-label={`Edit ${sink.name}`}
                                  >
                                    <FaPencilAlt />
                                  </Link>
                                  <Link
                                    to={`delete/${sink.id}`}
                                    className="text-white bg-gray-800 bg-opacity-60 rounded-full p-2 hover:bg-opacity-80 transition"
                                    title="Delete Sink"
                                    aria-label={`Delete ${sink.name}`}
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
