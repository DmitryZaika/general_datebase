import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { clsx } from "clsx";
import { PencilIcon, TrashIcon, CheckIcon } from "lucide-react";
import type { Todo } from "~/types";
import { Form, FormProvider, useForm } from "react-hook-form";
import { useFullFetcher } from "~/hooks/useFullFetcher";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormField } from "./ui/form";
import { InputItem } from "./molecules/InputItem";
import { todoListSchema, TTodoListSchema } from "~/schemas/general";
import { LoadingButton } from "./molecules/LoadingButton";
import { Checkbox } from "~/components/ui/checkbox";

interface EditFormProps {
  todo: Todo;
  refresh: (() => void) | ((callback: () => void) => void);
}

function AddForm({ refresh }: { refresh: () => void }) {
  const form = useForm<TTodoListSchema>({
    resolver: zodResolver(todoListSchema),
    defaultValues: { rich_text: "" },
  });
  const { fullSubmit, fetcher } = useFullFetcher(form, "/api/todoList");

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
              className="resize-none min-h-9 h-9 p-[4px]"
              formClassName="mb-0 w-full p-[2px] flex justify-center"
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
  const { fullSubmit, fetcher } = useFullFetcher(
    form,
    `/api/todoList/${todo.id}`
  );
  const [isEditing, setEditing] = useState<boolean>(false);

  useEffect(() => {
    if (fetcher.state === "idle") {
      refresh(() => setEditing(false));
    }
  }, [fetcher.state]);

  return (
    <FormProvider {...form}>
      <Form onSubmit={fullSubmit} className="flex items-center space-x-2  grow">
        <div className="grow w-full">
          {isEditing ? (
            <FormField
              control={form.control}
              name="rich_text"
              render={({ field }) => (
                <InputItem
                  className="resize-none min-h-9 h-9 w-full border-none focus:ring-0 p-[0px]"
                  formClassName="mb-0 w-full p-[2px] flex justify-center"
                  field={field}
                  inputAutoFocus={true}
                />
              )}
            />
          ) : (
            <p
              className={clsx("break-words max-w-[233px]", {
                "line-through": todo.is_done,
              })}
            >
              {todo.rich_text}
            </p>
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

function DeleteForm({ refresh, todo }: EditFormProps) {
  const form = useForm();
  const { fullSubmit, fetcher } = useFullFetcher(
    form,
    `/api/todoList/${todo.id}`,
    "DELETE"
  );
  useEffect(() => {
    if (fetcher.state === "idle") {
      refresh();
    }
  }, [fetcher.state]);

  return (
    <FormProvider {...form}>
      <Form onSubmit={fullSubmit}>
        <Button variant="ghost">
          <TrashIcon />
        </Button>
      </Form>
    </FormProvider>
  );
}

function FinishForm({ refresh, todo }: EditFormProps) {
  const [checked, setChecked] = useState<boolean>(Boolean(todo.is_done));

  async function handleCheckboxChange(isDone: boolean) {
    const formData = new FormData();
    formData.append("isDone", String(isDone));

    await fetch(`/api/todoList/${todo.id}`, {
      method: "PATCH",
      body: formData,
    });
    refresh();
  }

  async function handleToggle(value: boolean) {
    setChecked(Boolean(value));
    await handleCheckboxChange(value);
  }

  return (
    <Checkbox
      checked={checked}
      onCheckedChange={handleToggle}
      className="size-5 mr-2"
    />
  );
}

export function TodoList() {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [data, setData] = useState<{ todos: Todo[] } | undefined>();

  const getTodos = (callback: undefined | (() => void) = undefined) => {
    fetch("/api/todoList")
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
        className={`
          absolute bottom-0
          left-1/2 -translate-x-1/2
          -mb-4
          transform transition-all duration-300 ease-out
          ${
            isOpen
              ? "opacity-0 scale-90 pointer-events-none"
              : "opacity-100 scale-100"
          }
          sm:left-auto sm:-translate-x-0 sm:right-40
        `}
        onClick={() => setIsOpen(true)}
      >
        Todo List
      </Button>

      <div
        className={`
    absolute flex flex-col top-[calc(100%)] w-[400px] bg-white border rounded shadow-lg p-4 z-10  transform transition-all duration-300 ease-out
    ${
      isOpen
        ? "opacity-100 scale-100"
        : "opacity-0 scale-90 pointer-events-none"
    }
    left-1/2 -translate-x-1/2
    sm:right-0 sm:left-auto
  `}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Todo List</h2>
          <Button
            onClick={() => setIsOpen(false)}
            variant="ghost"
            aria-label="Close"
            size="icon"
            className="text-lg"
          >
            ✕
          </Button>
        </div>

        <AddForm refresh={getTodos} />

        <div className="overflow-y-auto max-h-60">
          {data?.todos?.map((todo) => {
            return (
              <div className="flex items-center" key={todo.id}>
                <FinishForm todo={todo} refresh={getTodos} />
                <EditForm todo={todo} refresh={getTodos} />
                <DeleteForm todo={todo} refresh={getTodos} />
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
