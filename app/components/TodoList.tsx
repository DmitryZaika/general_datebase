import { useState, useRef, useEffect } from "react";
import { Button } from "./ui/button";
import { TableBody, TableCell, TableRow } from "./ui/table";
import { PencilIcon, TrashIcon, CheckIcon } from "lucide-react";
import type { Todo } from "~/types";

export function TodoList() {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<Todo[]>([]);

  useEffect(() => {
    fetch("/todoList")
      .then(async (res) => await res.json())
      .then(setData);
  }, []);

  useEffect(() => {
    if (editingId !== null && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

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
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form
          method="post"
          action="/todoList"
          className="flex items-center space-x-2 mb-4"
        >
          <textarea
            name="rich_text"
            placeholder="Add new task"
            className="flex-1 px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-hidden"
            rows={1}
            onInput={(e) => {
              const target = e.currentTarget;
              target.style.height = "auto";
              target.style.height = target.scrollHeight + "px";
            }}
          />
          <button
            type="submit"
            name="intent"
            value="ADD"
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition"
          >
            Add
          </button>
        </form>

        <div className="overflow-y-auto max-h-60">
          <TableBody>
            {data.map((todo) => {
              const isEditing = editingId === todo.id;

              return (
                <TableRow key={todo.id}>
                  <TableCell className="font-medium w-full">
                    {isEditing ? (
                      <input
                        name="rich_text"
                        className="w-full border px-2 py-1 rounded focus:outline-none"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        ref={inputRef}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const form = e.currentTarget.form;
                            if (form) {
                              form.submit();
                            }
                          }
                        }}
                      />
                    ) : (
                      todo.rich_text
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    {isEditing ? (
                      <form method="post" action="/todoList">
                        <input type="hidden" name="intent" value="EDIT" />
                        <input type="hidden" name="id" value={todo.id} />
                        <input
                          type="hidden"
                          name="rich_text"
                          value={editingText}
                        />
                        <button
                          type="submit"
                          className="p-1 hover:bg-gray-100 rounded"
                          title="Save"
                        >
                          <CheckIcon />
                        </button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        className="p-1 hover:bg-gray-100 rounded"
                        title="Edit"
                        onClick={() => {
                          setEditingId(todo.id);
                          setEditingText(todo.rich_text);
                        }}
                      >
                        <PencilIcon />
                      </button>
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    <form method="post" action="/todoList">
                      <input type="hidden" name="id" value={todo.id} />
                      <button
                        type="submit"
                        name="intent"
                        value="DELETE"
                        className="p-1 hover:bg-gray-100 rounded"
                        title="Delete"
                      >
                        <TrashIcon />
                      </button>
                    </form>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </div>
      </div>
    </>
  );
}
