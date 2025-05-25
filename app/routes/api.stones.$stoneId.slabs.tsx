import { LoaderFunctionArgs, data } from "react-router";
import { db } from "~/db.server";
import { selectMany } from "~/utils/queryHelpers";

export async function loader({ request, params }: LoaderFunctionArgs) {
  if (!params.stoneId) {
    return new Response(JSON.stringify({ error: "Stone ID is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const stoneId = parseInt(params.stoneId, 10);
  if (isNaN(stoneId)) {
    return new Response(JSON.stringify({ error: "Invalid Stone ID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const excludeSlabId = url.searchParams.get("exclude");

  try {
    let query = `
      SELECT id, bundle
      FROM slab_inventory
      WHERE stone_id = ?
      AND sale_id IS NULL
    `;

    const queryParams = [stoneId];

    if (excludeSlabId) {
      query += " AND id != ?";
      queryParams.push(parseInt(excludeSlabId, 10));
    }

    const slabs = await selectMany<{ id: number; bundle: string }>(
      db,
      query,
      queryParams
    );

    return data({ slabs });
  } catch (error) {
    console.error("Error fetching slabs:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch slabs" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
