import { Button } from "../ui/button";
import { Form, FormProvider } from "react-hook-form";
import { FormField } from "../ui/form";
import { InputItem } from "../molecules/InputItem";

interface IDialogInsertFooterProps {
  form: any;
  handleSubmit: any;
}

export function DialogInsertFooter({
  form,
  handleSubmit,
}: IDialogInsertFooterProps) {
  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit} className="flex items-center space-x-2 ">
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
