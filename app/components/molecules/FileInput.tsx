import Compressor from "compressorjs";

import { FormControl, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Input } from "~/components/ui/input";

type FileInput = {
  inputName?: string;
  id: string;
  onChange: (event: Blob | undefined) => void;
};

export function FileInput({ onChange, id }: FileInput) {
  function compressImage(file: File | undefined) {
    if (!file) return;

    const THREE_MB = 3 * 1024 * 1024;
    const FIVE_HUNDRED_KB = 500 * 1024;

    if (file.size > THREE_MB) {
      new Compressor(file, {
        quality: 0.2,
        success(result) {
          onChange(result);
        },
        error(err) {
          console.error(err.message);
        },
      });
    } else if (file.size > FIVE_HUNDRED_KB) {
      new Compressor(file, {
        quality: 0.3,
        success(result) {
          onChange(result);
        },
        error(err) {
          console.error(err.message);
        },
      });
    } else {
      onChange(file);
    }
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
