import Compressor from "compressorjs";

import { FormControl, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Input } from "~/components/ui/input";

type FileInput = {
  inputName?: string;
  id: string;
  label?: string;
  type: "image" | "pdf";
  onChange: (event: File | undefined) => void;
};

function getQuality(size: number): number {
  const THREE_MB = 3 * 1024 * 1024;
  const FIVE_HUNDRED_KB = 500 * 1024;
  if (size > THREE_MB) {
    return 0.2;
  } else if (size > FIVE_HUNDRED_KB) {
    return 0.3;
  }
  return 1;
}

export function FileInput({ onChange, id, label = "Image", type }: FileInput) {
  function compressImage(file: File) {
    new Compressor(file, {
      quality: getQuality(file.size),
      success(result) {
        if (result instanceof File) {
          onChange(result);
        } else {
          const tempFile = new File([result], "temp.jpg");
          onChange(tempFile);
        }
      },
      error(err) {
        console.error(err.message);
      },
    });
  }

  function handleChange(file: File | undefined) {
    if (!file) return;
    if (type === "image") {
      compressImage(file);
    } else {
      onChange(file);
    }
  }

  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      <FormControl>
        <Input
          onChange={(event) => handleChange(event.target.files?.[0])}
          type="file"
          id={id}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  );
}
