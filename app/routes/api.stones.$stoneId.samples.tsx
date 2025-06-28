import { ActionFunctionArgs } from "react-router";
import { db } from "~/db.server";
import { csrf } from "~/utils/csrf.server";
import { getEmployeeUser } from "~/utils/session.server";

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    await csrf.validate(request);
  } catch (error) {
    return new Response(JSON.stringify({ error: "Invalid CSRF token" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const user = await getEmployeeUser(request);

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

  const formData = await request.formData();
  const amountStr = formData.get("amount");
  const importanceStr = formData.get("importance");

  const updates: string[] = [];
  const queryParams: any[] = [];

  if (amountStr !== null) {
    const amount = Number(amountStr);
    if (isNaN(amount) || amount < 0) {
      return new Response(JSON.stringify({ error: "Invalid amount" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    updates.push("samples_amount = ?");
    queryParams.push(amount);
  }

  if (importanceStr !== null) {
    const importance = Number(importanceStr);
    if (![1,2,3].includes(importance)) {
      return new Response(JSON.stringify({ error: "Invalid importance" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    updates.push("samples_importance = ?");
    queryParams.push(importance);
  }

  if (updates.length === 0) {
    return new Response(JSON.stringify({ error: "Nothing to update" }), { status: 400 });
  }

  queryParams.push(stoneId, user.company_id);

  try {
    await db.execute(
      `UPDATE stones SET ${updates.join(", ")} WHERE id = ? AND company_id = ?`,
      queryParams,
    );
    return new Response(JSON.stringify({ success: true }));
  } catch (error) {
    console.error("Error updating samples amount:", error);
    return new Response(JSON.stringify({ error: "Failed to update" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
} 