import { useState } from "react";
import { Form, useSubmit } from "@remix-run/react";
import { Button } from "./ui/button";
import { TableBody, TableCell, TableRow } from "./ui/table";
import { TrashIcon } from "lucide-react";
import { Todo } from "~/types";

interface Props {
  todos: Todo[];
}

export function TodoList({ todos }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const submit = useSubmit();

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
        className={`absolute flex flex-col top-[calc(100%)] right-0 transform -translate-x-1/2 w-[400px] bg-white border rounded shadow-lg p-4 z-50 transition-all duration-300 ease-out ${
          isOpen
            ? "opacity-100 scale-100"
            : "opacity-0 scale-90 pointer-events-none"
        }`}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Todo List</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="transition text-gray-500 hover:text-gray-700 text-xl focus:outline-none"
          >
            ✕
          </button>
        </div>
        <Form method="post" className="flex items-center space-x-2 mb-4">
          <input type="hidden" name="_action" value="createTodo" />
          <textarea
            name="rich_text"
            placeholder="Add new task"
            className="flex-1 px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-hidden"
            rows={1}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = target.scrollHeight + "px";
            }}
          />
          <Button type="submit">Add</Button>
        </Form>
        <div className="overflow-y-auto max-h-60">
          <TableBody>
            {todos.map((todo) => (
              <TableRow key={todo.id}>
                <TableCell className="flex items-center font-medium w-full">
                  <input
                    type="checkbox"
                    checked={todo.is_done}
                    className="form-checkbox h-5 w-5 text-blue-600 mr-2"
                  />
                  {editing === todo.id ? (
                    <Form method="post" className="flex-1 flex gap-2">
                      <input type="hidden" name="_action" value="editTodo" />
                      <input type="hidden" name="todoId" value={todo.id} />
                      <input
                        type="text"
                        name="rich_text"
                        defaultValue={todo.rich_text}
                        className="border px-2 py-1 w-full"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const form = e.currentTarget.form;
                            if (form) {
                              const richText = e.currentTarget.value;
                            }
                          }
                        }}
                      />
                      <Button type="submit">Save</Button>
                    </Form>
                  ) : (
                    <span
                      onClick={() => setEditing(todo.id)}
                      className={`flex-1 cursor-pointer ${
                        todo.is_done ? "line-through text-gray-500" : ""
                      }`}
                    >
                      {todo.rich_text}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right"></TableCell>
                <TableCell className="text-right">
                  {todo.is_done && (
                    <Form method="post">
                      <input type="hidden" name="_action" value="deleteTodo" />
                      <input type="hidden" name="todoId" value={todo.id} />
                      <button
                        type="submit"
                        className="p-1 hover:bg-gray-100 rounded"
                        aria-label="Delete Todo"
                      >
                        <TrashIcon />
                      </button>
                    </Form>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </div>
      </div>
    </>
  );
}
