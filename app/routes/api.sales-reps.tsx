import { LoaderFunctionArgs, data } from "react-router";
import { db } from "~/db.server";
import { selectMany } from "~/utils/queryHelpers";

interface User {
  id: number;
  name: string;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const users = await selectMany<User>(
    db,
    `SELECT u.id, u.name
     FROM users u
     JOIN positions p ON u.position_id = p.id
     WHERE LOWER(p.name) = 'sales_rep'`
  );

  return data({ users });
} 