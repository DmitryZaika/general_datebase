// app/routes/todoList.ts
import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  redirect,
} from "@remix-run/node";
import { db } from "~/db.server";
import { getValidatedFormData } from "remix-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { getEmployeeUser } from "~/utils/session.server";
import { todoListSchema, TTodoListSchema } from "~/schemas/general";
import { forceRedirectError } from "~/utils/toastHelpers";

const editAction = async (
  rich_text: string,
  todoId: number,
  userId: number
): Promise<void> => {
  await db.execute(
    `UPDATE main.todolist 
     SET rich_text = ?  
     WHERE id = ?
     AND user_id = ?;`,
    [rich_text, todoId, userId]
  );
};

const deleteAction = async (todoId: number, userId: number): Promise<void> => {
  await db.execute(
    `DELETE FROM main.todolist 
     WHERE id = ?
     AND user_id = ?;`,
    [todoId, userId]
  );
};

export async function action({ params, request }: ActionFunctionArgs) {
  const user = await getEmployeeUser(request);

  if (!params.todo) {
    return forceRedirectError(request.headers, "No user id provided");
  }

  const todoId = parseInt(params.todo, 10);
  if (!todoId) {
    return { name: undefined };
  }

  if (request.method === "POST") {
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

    await editAction(data.rich_text, todoId, user.id);
    return { success: true };
  }

  if (request.method === "DELETE") {
    await deleteAction(todoId, user.id);
    return { success: true };
  }

  return { success: false };
}
