// app/routes/admin.sinks.tsx
import { LoaderFunctionArgs, redirect } from "react-router";
import { selectMany } from "~/utils/queryHelpers";
import { db } from "~/db.server";
import { useLoaderData, Link, Outlet } from "react-router";
import { Button } from "~/components/ui/button";
import { FaPencilAlt, FaTimes } from "react-icons/fa";
import { getAdminUser } from "~/utils/session.server";

// Описываем поля, включая amount, width, height
interface Sink {
  id: number;
  name: string;
  url: string | null;
  amount: number | null;
  width: number | null;
  height: number | null;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getAdminUser(request);
  } catch (error) {
    return redirect(`/login?error=${encodeURIComponent(String(error))}`);
  }
  const user = await getAdminUser(request);

  // Выбираем поля amount, width, height (убедитесь, что они есть в БД!)
  const sinks = await selectMany<Sink>(
    db,
    `
      SELECT 
        id,
        name,
        url,
        amount,
        width,
        height
      FROM sinks
      WHERE company_id = ?
      ORDER BY name ASC
    `,
    [user.company_id]
  );

  return { sinks };
};

export default function AdminSinks() {
  const { sinks } = useLoaderData<typeof loader>();

  return (
    <>
      <Link to="add" className="inline-block mb-6">
        <Button>Add Sink</Button>
      </Link>

      <div className="pt-24 sm:pt-0">
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-3">
          {sinks.map((sink) => {
            // Чтобы отобразить "—" там, где нет значения
            const displayedAmount =
              sink.amount && sink.amount > 0 ? sink.amount : "—";
            const displayedWidth =
              sink.width && sink.width > 0 ? sink.width : "—";
            const displayedHeight =
              sink.height && sink.height > 0 ? sink.height : "—";

            return (
              <div key={sink.id} className="relative w-full">
                {/* Карточка */}
                <div className="border-2 border-blue-500 rounded p-2">
                  <div className="relative">
                    <img
                      src={sink.url || "/placeholder.png"}
                      alt={sink.name || "Sink Image"}
                      className="object-cover w-full h-40 rounded select-none"
                      loading="lazy"
                    />
                    {/* Если amount = 0, показываем "Out of Stock" */}
                    {sink.amount === 0 && (
                      <div className="absolute top-15 left-1/2 transform -translate-x-1/2 flex items-center justify-center whitespace-nowrap">
                        <div className="bg-red-500 text-white text-lg font-bold px-2 py-1 transform z-10 rotate-45 select-none">
                          Out of Stock
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Название + поля Amount и Size */}
                  <p className="text-center font-bold mt-2">{sink.name}</p>
                  <p className="text-center text-sm">
                    Amount: {displayedAmount}
                  </p>
                  <p className="text-center text-sm">
                    Size: {displayedWidth} x {displayedHeight}
                  </p>
                </div>

                {/* Иконки редактирования/удаления — ВСЕГДА видны, без hover */}
                <div className="absolute inset-0 flex justify-between opacity-50 items-start p-2">
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
      </div>
      <Outlet />
    </>
  );
}
