import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { clsx } from "clsx";
import { PencilIcon, TrashIcon, CheckIcon } from "lucide-react";
import type { Todo } from "~/types";
import { Form, FormProvider, useForm } from "react-hook-form";
import { useFullFetcher } from "~/hooks/useFullFetcher";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormField } from "../ui/form";
import { InputItem } from "../molecules/InputItem";
import { todoListSchema, TTodoListSchema } from "~/schemas/general";
import { LoadingButton } from "../molecules/LoadingButton";
import { Checkbox } from "~/components/ui/checkbox";
import { DialogFullHeader } from "../molecules/DialogFullHeader";
import { Dialog, DialogContent, DialogTrigger } from "~/components/ui/dialog";

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
    <Dialog modal={false}>
      <DialogTrigger
        className="fixed top-2 md:top-22 right-20 md:right-36"
        asChild
      >
        <Button>Todo List</Button>
      </DialogTrigger>
      <DialogContent
        className="h-screen p-0 gap-0"
        position="br"
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
      >
        <div className="h-full w-full bg-white border-l border-gray-300 shadow-lg flex flex-col overflow-y-auto">
          <DialogFullHeader>Todo List</DialogFullHeader>

          <div className="px-2">
            <AddForm refresh={getTodos} />

            <div className="overflow-y-auto max-h-60">
              {data?.todos
                ?.sort((a, b) =>
                  a.is_done === b.is_done ? 0 : a.is_done ? 1 : -1
                )
                .map((todo) => {
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
