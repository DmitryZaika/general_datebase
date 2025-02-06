// admin.stones.tsx

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
    "SELECT id, name, type, url FROM stones WHERE company_id = ?",
    [user.company_id]
  );
  return { stones };
};

export default function AdminStones() {
  const { stones } = useLoaderData<typeof loader>();

  const { currentId, setCurrentId } = useArrowToggle(
    (value: number | undefined) => (value ? [value] : [])
  );

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
    <>
      {" "}
      <Link to={`add`} relative="path">
        <Button>Add Stone</Button>
      </Link>
      <div className="pt-24 sm:pt-0">
        {/* Аккордеон по типам камней */}
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
                          {stoneList[type].map((stone) => (
                            <div key={stone.id} className="relative group">
                              <Image
                                id={stone.id}
                                src={stone.url}
                                alt={stone.name}
                                className="w-full h-12 object-cover rounded"
                                isOpen={currentId === stone.id}
                                setImage={setCurrentId}
                              />
                              <div className="absolute inset-0 flex justify-between items-start p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <Link
                                  to={`edit/${stone.id}`}
                                  className="text-white bg-gray-800 bg-opacity-60 rounded-full p-2 hover:bg-opacity-80 transition"
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
                              <div className="mt-2 text-center">
                                <h3 className="text-lg font-semibold">
                                  {stone.name}
                                </h3>
                              </div>
                            </div>
                          ))}
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
