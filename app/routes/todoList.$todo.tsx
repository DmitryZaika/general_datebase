// app/routes/todoList.ts
import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  redirect,
} from "@remix-run/node";
import { db } from "~/db.server";

import { getEmployeeUser } from "~/utils/session.server";

const editAction = async (
  formData: FormData,
  userId: number
): Promise<void> => {
  console.log("editAction userId:", userId);
  await db.execute(
    `UPDATE main.todolist 
     SET rich_text = ?  
     WHERE id = ?;`,
    [formData.get("rich_text"), formData.get("id")]
  );
};

const deleteAction = async (
  formData: FormData,
  userId: number
): Promise<void> => {
  console.log("deleteAction userId:", userId);
  await db.execute(
    `DELETE FROM main.todolist 
     WHERE id = ?;`,
    [formData.get("id")]
  );
};

export async function action({ request }: ActionFunctionArgs) {
  const user = await getEmployeeUser(request);
  const formData = await request.formData();

  if (request.method === "POST") {
    await editAction(formData, user.id);
    return { success: true };
  }

  if (request.method === "DELETE") {
    await deleteAction(formData, user.id);
    return { success: true };
  }

  return { success: false };
}
