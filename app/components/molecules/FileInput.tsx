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

const acceptsMap = {
  image:
    "image/png, image/jpeg, image/gif, image/webp, image/svg+xml, image/tiff, image/bmp, image/x-icon, image/heif, image/x-canon-cr2, image/x-nikon-nef",
  pdf: "application/pdf",
};

function getQuality(size: number): number {
  const THREE_MB = 3 * 1024 * 1024;
  const ONE_MB = 1 * 1024 * 1024;

  if (size > THREE_MB) {
    return 0.2;
  } else if (size > ONE_MB) {
    return 0.3;
  } else {
    return 0.5;
  }
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
          accept={acceptsMap[type]}
          id={id}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  );
}
