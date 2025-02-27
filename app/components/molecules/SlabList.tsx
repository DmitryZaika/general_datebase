import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { selectId } from "~/utils/queryHelpers";

export async function action({ request, params }: ActionFunctionArgs) {}

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const stoneId = parseInt(params.stone, 10);
  const stone = await selectId<{
    name: string;
    type: string;
    url: string;
    is_display: boolean;
    supplier: string;
    height: string;
    width: string;
  }>(
    db,
    "SELECT name, type, url, is_display, supplier, height, width FROM  WHERE id = ?",
    stoneId
  );
};

export function SlabList() {}
