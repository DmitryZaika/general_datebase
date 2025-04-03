import Compressor from "compressorjs";

import { FormControl, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Input } from "~/components/ui/input";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";

type FileInput = {
  inputName?: string;
  id: string;
  label?: string;
  type: "image" | "pdf";
  className?: string;
  onChange: (event: File | undefined) => void;
};

const acceptsMap = {
  image:
    "image/png, image/jpeg, image/jpg, image/gif, image/webp, image/svg+xml, image/tiff, image/bmp, image/x-icon, image/heif, image/x-canon-cr2, image/x-nikon-nef",
  pdf: "application/pdf",
};

function getQuality(size: number): number {
  const SEVEN_MB = 7 * 1024 * 1024;
  const FIVE_MB = 5 * 1024 * 1024;
  const THREE_MB = 3 * 1024 * 1024;
  const ONE_MB = 1 * 1024 * 1024;

  if (size > SEVEN_MB) {
    return 0.3;
  } else if (size > FIVE_MB) {
    return 0.35;
  } else if (size > THREE_MB) {
    return 0.4;
  } else if (size > ONE_MB) {
    return 0.5;
  } else {
    return 0.7;
  }
}

export function FileInput({
  onChange,
  id,
  label = "Image",
  type,
  className,
}: FileInput) {
  const [captureMode, setCaptureMode] = useState<"environment" | "user" | undefined>(
    type === "image" ? "environment" : undefined
  );

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
        <div className="space-y-3">
          <Input
            className={className}
            onChange={(event) => handleChange(event.target.files?.[0])}
            type="file"
            accept={acceptsMap[type]}
            id={id}
            capture={captureMode}
          />
          {type === "image" && (
            <div className="flex flex-col gap-2 sm:hidden">
              <div className="text-sm font-medium">Source:</div>
              <div className="flex gap-1">
                <Button
                  type="button" 
                  variant="outline"
                  size="sm"
                  className={`text-xs border-gray-300 ${captureMode === "environment" ? "bg-blue-100 border-blue-500 text-blue-700" : ""}`}
                  onClick={() => setCaptureMode("environment")}
                >
                  Rear Camera
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={`text-xs border-gray-300 ${captureMode === "user" ? "bg-blue-100 border-blue-500 text-blue-700" : ""}`}
                  onClick={() => setCaptureMode("user")}
                >
                  Front Camera
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={`text-xs border-gray-300 ${captureMode === undefined ? "bg-blue-100 border-blue-500 text-blue-700" : ""}`}
                  onClick={() => setCaptureMode(undefined)}
                >
                  Gallery
                </Button>
              </div>
            </div>
          )}
        </div>
      </FormControl>
      <FormMessage />
    </FormItem>
  );
}
