import { useState, useRef, useEffect } from "react";
import { Button } from "./ui/button";
import { TableBody, TableCell, TableRow } from "./ui/table";
import { PencilIcon, TrashIcon, CheckIcon } from "lucide-react";
import type { Todo } from "~/types";
import { Form, FormProvider, useForm } from "react-hook-form";
import { useFullFetcher } from "~/hooks/useFullFetcher";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormField } from "./ui/form";
import { InputItem } from "./molecules/InputItem";
import { todoListSchema, TTodoListSchema } from "~/schemas/general";
import { LoadingButton } from "./molecules/LoadingButton";

interface EditFormProps {
  todo: Todo;
  refresh: (callback: () => void) => void;
}

function AddForm({ refresh }: { refresh: () => void }) {
  const form = useForm<TTodoListSchema>({
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

function EditForm({ refresh, todo }: EditFormProps) {
  const form = useForm<TTodoListSchema>({
    resolver: zodResolver(todoListSchema),
    defaultValues: { rich_text: todo.rich_text },
  });
  const { fullSubmit, fetcher } = useFullFetcher(form, `/todoList/${todo.id}`);
  const [isEditing, setEditing] = useState<boolean>(false);

  useEffect(() => {
    if (fetcher.state === "idle") {
      refresh(() => setEditing(false));
    }
  }, [fetcher.state]);

  return (
    <FormProvider {...form}>
      <Form
        onSubmit={fullSubmit}
        className="flex items-center space-x-2 w-full flex-grow"
      >
        <div className="flex-grow">
          {isEditing ? (
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
          ) : (
            <p>{todo.rich_text}</p>
          )}
        </div>
        {isEditing ? (
          <LoadingButton loading={fetcher.state !== "idle"}>
            <CheckIcon />
          </LoadingButton>
        ) : (
          <Button
            variant="ghost"
            className="ml-auto"
            onClick={() => setEditing(true)}
          >
            <PencilIcon />
          </Button>
        )}
      </Form>
    </FormProvider>
  );
}

export function TodoList() {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<{ todos: Todo[] } | undefined>();

  const getTodos = (callback: undefined | (() => void) = undefined) => {
    fetch("/todoList")
      .then(async (res) => await res.json())
      .then(setData)
      .then(() => callback && callback());
  };

  useEffect(() => {
    getTodos();
  }, []);

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
          {data?.todos?.map((todo) => {
            return (
              <div className="flex" key={todo.id}>
                <EditForm todo={todo} refresh={getTodos} />
                <form method="post" action="/todoList" className="ml-auto">
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
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
