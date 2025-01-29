// app/routes/todoList.ts
import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  redirect,
} from "@remix-run/node";
import { db } from "~/db.server";
import { commitSession, getSession } from "~/sessions";
import { Todo } from "~/types";
import { csrf } from "~/utils/csrf.server";
import { selectMany } from "~/utils/queryHelpers";
import { getAdminUser, getEmployeeUser } from "~/utils/session.server";
import { toastData } from "~/utils/toastHelpers";

const addAction = async (formData: FormData, userId: number): Promise<void> => {
  console.log("addAction userId:", userId);
  await db.execute(
    `INSERT INTO main.todolist (rich_text, user_id) VALUES (?, ?);`,
    [formData.get("rich_text"), userId]
  );
};

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
  const intent = formData.get("intent");

  if (intent === "ADD") {
    await addAction(formData, user.id);
    return redirect("/todoList");
  }

  if (intent === "EDIT") {
    await editAction(formData, user.id);
    return redirect("/todoList");
  }

  if (intent === "DELETE") {
    await deleteAction(formData, user.id);
    return redirect("/todoList");
  }

  return redirect("/todoList");
}

export async function loader({ request }: LoaderFunctionArgs) {
  let user;
  try {
    user = await getEmployeeUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }

  const todos = await selectMany<Todo>(
    db,
    "SELECT id, rich_text, is_done FROM todolist WHERE user_id = ?",
    [user.id]
  );
}
