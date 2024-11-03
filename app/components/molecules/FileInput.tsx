import { FormControl, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Input } from "~/components/ui/input";

type FileInput = {
  name: string;
  id: string;
  onChange: (event: File | undefined) => void;
};

export function FileInput({ onChange, name, id }: FileInput) {
  return (
    <FormItem>
      <FormLabel>{name}</FormLabel>
      <FormControl>
        <Input
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
