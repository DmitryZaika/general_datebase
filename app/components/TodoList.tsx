import React, { useState } from "react";
import { Button } from "./ui/button";

interface Todo {
  id: number;
  name: string;
}

export function TodoList() {
  const [isOpen, setIsOpen] = useState<boolean>(false);

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
        </div>

        <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition">
          Add
        </button>
        <button className="text-red-500 hover:text-red-700">Delete</button>
      </div>
    </>
  );
}
