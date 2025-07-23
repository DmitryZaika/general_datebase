import { LoaderFunctionArgs, data } from "react-router";
import { db } from "~/db.server";
import { getEmployeeUser } from "~/utils/session.server";
import { selectMany } from "~/utils/queryHelpers";

interface Notification {
  id: number;
  message: string;
  due_at: string;
  customer_name: string | null;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getEmployeeUser(request);

  const notifications = await selectMany<Notification>(
    db,
    `SELECT n.id, n.message, n.due_at, c.name AS customer_name
     FROM notifications n
     LEFT JOIN customers c ON n.customer_id = c.id
     WHERE n.user_id = ? AND n.is_done = 0 AND n.due_at <= NOW()
     ORDER BY n.due_at DESC`,
    [user.id],
  );

  return data({ notifications });
} 