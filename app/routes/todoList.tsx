import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  redirect,
} from "@remix-run/node";
import { getValidatedFormData } from "remix-hook-form";
import { db } from "~/db.server";
import { todoListSchema, TTodoListSchema } from "~/schemas/general";
import { Todo } from "~/types";
import { selectMany } from "~/utils/queryHelpers";
import { getEmployeeUser } from "~/utils/session.server";

export async function action({ request }: ActionFunctionArgs) {
  const user = await getEmployeeUser(request);

  const {
    errors,
    data,
    receivedValues: defaultValues,
  } = await getValidatedFormData<TTodoListSchema>(
    request,
    zodResolver(todoListSchema)
  );
  if (errors) {
    return { errors, defaultValues };
  }

  await db.execute(
    `INSERT INTO main.todolist (rich_text, user_id) VALUES (?, ?);`,
    [data.rich_text, user.id]
  );
  return { success: true };
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
  return { todos };
}
