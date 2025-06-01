import { LoaderFunctionArgs, data } from "react-router";
import { db } from "~/db.server";
import { getEmployeeUser } from "~/utils/session.server";
import { selectMany } from "~/utils/queryHelpers";
import { Customer } from "~/types";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getEmployeeUser(request);
  const url = new URL(request.url);
  const term = url.searchParams.get("term") || "";

  try {
    const customers = await selectMany<Customer>(
      db,
      `SELECT id, name, address, phone, email 
       FROM customers 
       WHERE company_id = ? AND name LIKE ? 
       ORDER BY name DESC
       LIMIT 50`,
      [user.company_id, `%${term}%`]
    );

    return data({ customers });
  } catch (error) {
    console.error("Error searching customers:", error);
    return data({ error: "Failed to search customers" }, { status: 500 });
  }
}
