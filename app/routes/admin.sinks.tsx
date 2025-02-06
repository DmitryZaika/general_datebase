// admin.sinks.tsx

import React from "react";
import { LoaderFunctionArgs, redirect } from "@remix-run/node";
import { selectMany } from "~/utils/queryHelpers";
import { db } from "~/db.server";
import { useLoaderData, Link, Outlet } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { FaPencilAlt, FaTimes } from "react-icons/fa";
import { Image } from "~/components/molecules/Image";
import { getAdminUser } from "~/utils/session.server";
import { useArrowToggle } from "~/hooks/useArrowToggle";

interface Sink {
  id: number;
  name: string;
  url: string | null;
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
    "SELECT id, name, url FROM sinks WHERE company_id = ?",
    [user.company_id]
  );

  return { sinks };
};

export default function AdminSinks() {
  const { sinks } = useLoaderData<typeof loader>();

  const { currentId, setCurrentId } = useArrowToggle(
    (value: number | undefined) => (value ? [value] : [])
  );

  return (
    <>
      <Link to={`add`} relative="path" className="mb-6 inline-block">
        <Button>Add Sink</Button>
      </Link>
      <div className="pt-24 sm:pt-0">
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-3">
          {sinks.map((sink) => (
            <div key={sink.id} className="relative group">
              <Image
                id={sink.id}
                src={sink.url}
                alt={sink.name}
                className="w-full h-48 object-cover rounded"
                isOpen={currentId === sink.id}
                setImage={setCurrentId}
              />

              <div className="absolute inset-0 flex justify-between items-start p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
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

              <div className="mt-2 text-center">
                <h3 className="text-lg font-semibold">{sink.name}</h3>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Outlet />
    </>
  );
}
