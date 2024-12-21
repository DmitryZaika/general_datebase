import { useState } from "react";
import { Button } from "./ui/button";
import { useLoaderData } from "@remix-run/react";
import { TableBody, TableCell, TableRow } from "./ui/table";
import { PencilIcon, TrashIcon } from "lucide-react";

export function TodoList() {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const { todos } = useLoaderData<typeof loader>();

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
        <div className="flex items-center space-x-2 mb-4">
          <textarea
            placeholder="Add new task"
            className="flex-1 px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-hidden"
            rows={1}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = target.scrollHeight + "px";
            }}
          ></textarea>
          <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition">
            Add
          </button>
        </div>
        <div className="overflow-y-auto max-h-60">
          <TableBody>
            {(todos || []).map((todo) => (
              <TableRow key={todo.id}>
                <TableCell className="font-medium w-full ">
                  {todo.name}
                </TableCell>
                <TableCell className=" text-right">
                  <button className=" p-1 hover:bg-gray-100 rounded">
                    <PencilIcon />
                  </button>
                </TableCell>
                <TableCell className=" text-right">
                  <button className=" p-1 hover:bg-gray-100 rounded">
                    <TrashIcon />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </div>
      </div>
    </>
  );
}
