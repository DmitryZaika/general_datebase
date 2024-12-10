import React, { useState } from "react";
import { Button } from "./ui/button";
import { selectMany } from "~/utils/queryHelpers";
import { getAdminUser } from "~/utils/session.server";
import { LoaderFunctionArgs, redirect } from "@remix-run/node";
import { db } from "~/db.server";
import { TableBody, TableCell, TableRow } from "./ui/table";
import { Link, useLoaderData } from "@remix-run/react";

interface Todo {
  id: number;
  name: string;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getAdminUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  const todos = await selectMany<Todo>(
    db,
    "select id, name, is_done from todolist"
  );
  return {
    todos,
  };
};

export function TodoList() {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const { todos } = useLoaderData<typeof loader>() || { todos: [] };

  return (
    <>
      <Button
        className={`transform -translate-x-1/2 transition-all duration-300 ease-out ${
          isOpen
            ? "opacity-0 scale-90 pointer-events-none"
            : "opacity-100 scale-100"
        } -mb-4 right-40 absolute bottom-0`}
        onClick={() => setIsOpen(true)}
      >
        Todo List
      </Button>
      <div
        className={`absolute top-[calc(100%)] right-10 transform -translate-x-1/2 w-[300px] bg-white border rounded shadow-lg p-4 z-50 transition-all duration-300 ease-out ${
          isOpen
            ? "opacity-100 scale-100"
            : "opacity-0 scale-90 pointer-events-none"
        }`}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Todo List</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="transition text-gray-500 hover:text-gray-700 text-lg"
          >
            ✕
          </button>
          <div className="">
            <input
              type="text"
              className=" px-4 py-2 rounded hover:bg-blue-600 transition"
            />
            <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition">
              Add
            </button>
          </div>
        </div>

        {/* <TableBody>
          {todos.map((todo) => (
            <TableRow key={todo.id}>
              <TableCell className="font-medium w-[200px]">
                {todo.name}
              </TableCell>
              <TableCell className="text-right">
                <Button className="text-xl">Edit</Button>
              </TableCell>
              <TableCell className="w-[200px] text-right">
                <Button className="text-xl">Delete</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody> */}
      </div>
    </>
  );
}
