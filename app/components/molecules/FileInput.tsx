import { FormControl, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Input } from "~/components/ui/input";

type FileInput = {
  inputName?: string;
  id: string;
  onChange: (event: File | undefined) => void;
};

export function FileInput({ onChange, inputName, id }: FileInput) {
  return (
    <FormItem>
      <FormLabel>Image</FormLabel>
      <FormControl>
        <Input
          name={inputName}
          onChange={(event) => {
            onChange(event.target.files?.[0]);
          }}
          type="file"
          id={id}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  );
}
