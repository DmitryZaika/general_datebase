import Compressor from "compressorjs";

import { FormControl, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Input } from "~/components/ui/input";
import { useRef } from "react";
import { Button } from "~/components/ui/button";

type FileInput = {
  inputName?: string;
  id: string;
  label?: string;
  type: "image" | "pdf";
  className?: string;
  onChange: (event: File | undefined) => void;
  showCameraOptions?: boolean;
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
  showCameraOptions = false,
}: FileInput) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
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
        <div className="space-y-2">
          {/* Стандартный input - показывается всегда на ПК и на мобильных если не нужны кнопки камеры */}
          <Input
            className={`${className} ${showCameraOptions ? 'hidden sm:block' : ''}`}
            onChange={(event) => handleChange(event.target.files?.[0])}
            type="file"
            accept={acceptsMap[type]}
            id={id}
          />
          
          {/* Скрытые input поля и кнопки для мобильных - только когда showCameraOptions=true */}
          {type === "image" && showCameraOptions && (
            <>
              <Input
                className="hidden"
                ref={fileInputRef}
                onChange={(event) => handleChange(event.target.files?.[0])}
                type="file"
                accept={acceptsMap.image}
              />
              
              <Input
                className="hidden"
                ref={cameraInputRef}
                onChange={(event) => handleChange(event.target.files?.[0])}
                type="file"
                accept="image/*"
                capture="environment"
              />
              
              {/* Видимые кнопки только на мобильных */}
              <div className="flex flex-col space-y-2 sm:hidden">
                <Button 
                  type="button"
                  variant="default"
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full"
                >
                  Take Photo
                </Button>
                
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                >
                  Choose from Gallery
                </Button>
              </div>
            </>
          )}
        </div>
      </FormControl>
      <FormMessage />
    </FormItem>
  );
}
