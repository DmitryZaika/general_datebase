import Compressor from 'compressorjs';

import { FormControl, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Input } from "~/components/ui/input";

type FileInput = {
  inputName?: string;
  id: string;
  onChange: (event: Blob | undefined) => void;
};

export function FileInput({ onChange, id }: FileInput) {
  function compressImage(file: File | undefined) {
    if (!file) {
      return;
    }
    console.log(file.size)
    new Compressor(file, {
      quality: 0.3,

      success(result) {
        onChange(result)
      },
      error(err) {
        console.log(err.message);
      },
  });
  }
  return (
    <FormItem>
      <FormLabel>Image</FormLabel>
      <FormControl>
        <Input
          onChange={(event) => compressImage(event.target.files?.[0])}
          type="file"
          id={id}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  );
}
