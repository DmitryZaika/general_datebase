import { data, LoaderFunctionArgs } from "react-router";
import { db } from "~/db.server";
import { selectMany } from "~/utils/queryHelpers";

export async function loader({ params }: LoaderFunctionArgs) {
  const slabId = params.slabId;
  if (!slabId) {
    throw new Error("Stone ID is required");
  }

  const stoneInfo = await selectMany<{
    id: number;
    type: string;
    name: string;
  }>(
    db,
    `SELECT stones.id, stones.type, stones.name
     FROM stones 
     JOIN slab_inventory ON slab_inventory.stone_id = stones.id 
     WHERE slab_inventory.id = ?`,
    [slabId]
  );


  if (stoneInfo.length === 0) {
    throw new Error("Stone not found");
  }

  return data({ id: stoneInfo[0].id, type: stoneInfo[0].type, name: stoneInfo[0].name });
}