//// filepath: c:\Users\sarah\general_datebase\app\routes\admin.stones.tsx
import { LoaderFunctionArgs, Outlet } from "react-router";
import { useLoaderData, Link, useSearchParams, useNavigation } from "react-router";

import { FaPencilAlt, FaTimes } from "react-icons/fa";

import { Button } from "~/components/ui/button";
import { getAdminUser } from "~/utils/session.server";
import { stoneQueryBuilder } from "~/utils/queries";
import { stoneFilterSchema } from "~/schemas/stones";
import { cleanParams } from "~/hooks/use-safe-search-params";
import { STONE_TYPES } from "~/utils/constants";
import ModuleList from "~/components/ModuleList";
import { LoadingButton } from "~/components/molecules/LoadingButton";
import { useEffect, useState } from "react";

interface Stone {
  id: number;
  name: string;
  type: string;
  url: string | null;
  is_display: boolean | number;
  length: number | null;
  width: number | null;
  amount: number;
  available: number;
}

function customSortType(
  a: (typeof STONE_TYPES)[number],
  b: (typeof STONE_TYPES)[number]
) {
  return STONE_TYPES.indexOf(a) - STONE_TYPES.indexOf(b);
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
  const [, searchParams] = request.url.split("?");
  const queryParams = new URLSearchParams(searchParams);
  const filters = stoneFilterSchema.parse(cleanParams(queryParams));
  const stones = await stoneQueryBuilder(filters, user.company_id, true);

  return { stones };
};

export default function AdminStones() {
  const { stones } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const navigation = useNavigation();
  const [isRoleSwitching, setIsRoleSwitching] = useState(false);
  const [isAddingStone, setIsAddingStone] = useState(false);

  useEffect(() => {
    if (navigation.state === "idle") {
      if (isRoleSwitching) setIsRoleSwitching(false);
      if (isAddingStone) setIsAddingStone(false);
    }
  }, [navigation.state]);

  const handleAddStoneClick = () => {
    setIsAddingStone(true);
  };

  const stoneList = stones.reduce((acc: Record<string, Stone[]>, stone) => {
    if (!acc[stone.type]) {
      acc[stone.type] = [];
    }
    acc[stone.type].push(stone);
    return acc;
  }, {});

  const getEditUrl = (stoneId: number) => {
    const currentParams = new URLSearchParams(searchParams);
    return `edit/${stoneId}?${currentParams.toString()}`;
  };

  return (
    <>
      <Link to="add" onClick={handleAddStoneClick}>
        <LoadingButton loading={isAddingStone}>Add Stone</LoadingButton>
      </Link>

      <div className="pt-24 sm:pt-0">
        <ModuleList>
          {stones
            .sort((a, b) => {
              const priorityA = getStonePriority(a);
              const priorityB = getStonePriority(b);
              if (priorityA !== priorityB) {
                return priorityA - priorityB;
              }
              return a.name.localeCompare(b.name);
            })
            .map((stone) => {
              const displayedAmount = stone.amount > 0 ? stone.amount : "—";
              const displayedAvailable = stone.available;
              const displayedWidth =
                stone.width && stone.width > 0 ? stone.width : "—";
              const displayedLength =
                stone.length && stone.length > 0 ? stone.length : "—";

              return (
                <div key={stone.id} className="relative w-full module-item">
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
                    <p className="text-center font-bold mt-2">{stone.name}</p>
                    <p className="text-center text-sm">
                      Available: {displayedAvailable} / {displayedAmount}
                    </p>
                    <p className="text-center text-sm">
                      Size: {displayedLength} x {displayedWidth}
                    </p>
                    <p className="text-center text-sm">
                      Price: ${stone.retail_price}
                    </p>
                    <p className="text-center text-sm">
                      Cost per sqft: ${stone.cost_per_sqft}
                    </p>
                  </div>

                  <div className="absolute inset-0 flex justify-between items-start p-2 opacity-50 transition-opacity duration-300">
                    <Link
                      to={getEditUrl(stone.id)}
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
        </ModuleList>
        <Outlet />
      </div>
    </>
  );
}
