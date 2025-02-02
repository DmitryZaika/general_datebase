import { useState, useRef, useEffect } from "react";
import { Button } from "./ui/button";
import { TableBody, TableCell, TableRow } from "./ui/table";
import { PencilIcon, TrashIcon, CheckIcon } from "lucide-react";
import type { Todo } from "~/types";
import { Form, FormProvider, useForm } from "react-hook-form";
import { useFullFetcher } from "~/hooks/useFullFetcher";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormField } from "./ui/form";
import { InputItem } from "./molecules/InputItem";

interface EditFormProps {
  todo: Todo;
}

const todoListSchema = z.object({
  rich_text: z.string().min(1),
});

type FormData = z.infer<typeof todoListSchema>;

function AddForm({ refresh }: { refresh: () => void }) {
  const form = useForm<FormData>({
    resolver: zodResolver(todoListSchema),
    defaultValues: { rich_text: "" },
  });
  const { fullSubmit, fetcher } = useFullFetcher(form, "/todoList");

  useEffect(() => {
    if (fetcher.state === "idle") {
      refresh();
      form.reset();
    }
  }, [fetcher.state]);

  console.log(fetcher.state);
  return (
    <FormProvider {...form}>
      <Form onSubmit={fullSubmit} className="flex items-center space-x-2 ">
        <FormField
          control={form.control}
          name="rich_text"
          render={({ field }) => (
            <InputItem
              placeholder="Add new task"
              className="resize-none min-h-9 h-9 p-[2px]"
              formClassName="mb-0"
              field={field}
            />
          )}
        />
        <Button type="submit" variant={"blue"}>
          Add
        </Button>
      </Form>
    </FormProvider>
  );
}

function EditForm({ todo }: EditFormProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(todoListSchema),
    defaultValues: { rich_text: todo.rich_text },
  });
  const fullSubmit = useFullFetcher(form, `/todoList/${todo.id}`, "POST");
  return (
    <FormProvider {...form}>
      <Form onSubmit={fullSubmit} className="flex items-center space-x-2 ">
        <FormField
          control={form.control}
          name="rich_text"
          render={({ field }) => (
            <InputItem
              className="resize-none min-h-9 h-9 p-[2px]"
              formClassName="mb-0"
              field={field}
            />
          )}
        />
        <Button type="submit" title="Save">
          <CheckIcon />
        </Button>
      </Form>
    </FormProvider>
  );
}

export function TodoList() {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<{ todos: Todo[] } | undefined>();

  const getTodos = () => {
    fetch("/todoList")
      .then(async (res) => await res.json())
      .then(setData);
  };

  useEffect(() => {
    getTodos();
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

        <AddForm refresh={getTodos} />

        <div className="overflow-y-auto max-h-60">
          <TableBody>
            {data?.todos?.map((todo) => {
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
                      <EditForm todo={todo} />
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
