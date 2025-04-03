// app/routes/admin.sinks.tsx

import { LoaderFunctionArgs, redirect, Outlet } from "react-router";
import { useLoaderData, Link, useNavigation, useLocation } from "react-router";
import { getAdminUser } from "~/utils/session.server";
import { LoadingButton } from "~/components/molecules/LoadingButton";
import { useEffect, useState } from "react";
import ModuleList from "~/components/ModuleList";
import { SuperCarousel } from "~/components/organisms/SuperCarousel";
import { FaPencilAlt, FaTimes } from "react-icons/fa";
import { useSafeSearchParams } from "~/hooks/use-safe-search-params";
import { sinkFilterSchema } from "~/schemas/sinks";
import { cleanParams } from "~/hooks/use-safe-search-params";
import { Sink, sinkQueryBuilder } from "~/utils/queries";
import { SidebarTrigger } from "~/components/ui/sidebar";

const customOrder = [
  "stainless 18 gauge",
  "stainless 16 gauge",
  "granite composite",
  "ceramic",
  "farm house",
];

function customSort(a: string, b: string) {
  const aIndex = customOrder.findIndex(
    (item) => item.toLowerCase() === a.toLowerCase()
  );
  const bIndex = customOrder.findIndex(
    (item) => item.toLowerCase() === b.toLowerCase()
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
  const [, searchParams] = request.url.split("?");
  const queryParams = new URLSearchParams(searchParams);
  const filters = sinkFilterSchema.parse(cleanParams(queryParams));

  const sinks = await sinkQueryBuilder(filters, user.company_id);

  return { sinks };
};

export default function AdminSinks() {
  const { sinks } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [isAddingSink, setIsAddingSink] = useState(false);
  const [sortedSinks, setSortedSinks] = useState<Sink[]>(sinks);
  const location = useLocation();
  const [currentId, setCurrentId] = useState<number | undefined>(undefined);
  const [searchParams] = useSafeSearchParams(sinkFilterSchema);

  useEffect(() => {
    const inStock = sinks.filter(sink => Number(sink.amount) > 0 && Boolean(sink.is_display));
    const outOfStock = sinks.filter(sink => Number(sink.amount) <= 0 && Boolean(sink.is_display));
    const notDisplayed = sinks.filter(sink => !Boolean(sink.is_display));
    
    const sortedInStock = [...inStock].sort((a, b) => a.name.localeCompare(b.name));
    const sortedOutOfStock = [...outOfStock].sort((a, b) => a.name.localeCompare(b.name));
    const sortedNotDisplayed = [...notDisplayed].sort((a, b) => a.name.localeCompare(b.name));
    
    setSortedSinks([...sortedInStock, ...sortedOutOfStock, ...sortedNotDisplayed]);
  }, [sinks]);

  useEffect(() => {
    if (navigation.state === "idle") {
      if (isAddingSink) setIsAddingSink(false);
    }
  }, [navigation.state]);

  const handleAddSinkClick = () => {
    setIsAddingSink(true);
  };

  const handleSetCurrentId = (id: number | undefined) => {
    setCurrentId(id);
  };

  return (
    <>
      <div className="flex justify-between mb-2">
        <Link to="add" onClick={handleAddSinkClick}>
          <LoadingButton className="mt-2 ml-2 -mb-3" loading={isAddingSink}>Add Sink</LoadingButton>
        </Link>
      
      </div>

      <div>
        <ModuleList>
          <div className="w-full col-span-full">
            <SuperCarousel
              type="sinks"
              currentId={currentId}
              setCurrentId={handleSetCurrentId}
              images={sortedSinks}
            />
          </div>
          {sortedSinks.map((sink) => {
            const displayedAmount =
              sink.amount && sink.amount > 0 ? sink.amount : "—";
            const displayedWidth =
              sink.width && sink.width > 0 ? sink.width : "—";
            const displayedLength =
              sink.length && sink.length > 0 ? sink.length : "—";

            return (
              <div key={sink.id} className="relative w-full module-item">
                <div
                  className={`border-2 border-blue-500 rounded ${
                    !sink.is_display ? "opacity-30" : ""
                  }`}
                >
                  <div className="relative">
                    <img
                      src={sink.url || "/placeholder.png"}
                      alt={sink.name || "Sink Image"}
                      className="object-cover w-full h-40 rounded select-none cursor-pointer"
                      loading="lazy"
                      onClick={() => handleSetCurrentId(sink.id)}
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
                    Size: {displayedLength} x {displayedWidth}
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
        </ModuleList>
        <Outlet />
      </div>
    </>
  );
}
