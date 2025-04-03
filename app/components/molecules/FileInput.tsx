import Compressor from "compressorjs";

import { FormControl, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Input } from "~/components/ui/input";
import { useState, useRef, useEffect } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose
} from "~/components/ui/dialog";

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
  const [openDialog, setOpenDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  
  // Лучший способ определить мобильное устройство через медиа-запрос
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.matchMedia("(max-width: 640px)").matches);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);
  
  function compressImage(file: File) {
    setIsLoading(true);
    new Compressor(file, {
      quality: getQuality(file.size),
      success(result) {
        setIsLoading(false);
        if (result instanceof File) {
          onChange(result);
        } else {
          const tempFile = new File([result], "temp.jpg");
          onChange(tempFile);
        }
      },
      error(err) {
        setIsLoading(false);
        console.error(err.message);
        // Можно здесь добавить вывод ошибки пользователю
      },
    });
  }

  function handleChange(file: File | undefined) {
    if (!file) return;
    try {
      if (type === "image") {
        compressImage(file);
      } else {
        onChange(file);
      }
    } catch (error) {
      console.error("Error processing file:", error);
    }
    
    // Закрываем диалог после выбора
    setOpenDialog(false);
  }

  // Обработчик для клика на кнопку Choose File
  const handleChooseFileClick = (e: React.MouseEvent) => {
    // Только для изображений на мобильных устройствах показываем диалог
    if (type === "image" && isMobile) {
      e.preventDefault();
      setOpenDialog(true);
    }
  };

  const triggerCameraInput = () => {
    setOpenDialog(false);
    if (cameraInputRef.current) {
      try {
        cameraInputRef.current.click();
      } catch (error) {
        console.error("Error triggering camera input:", error);
      }
    }
  };

  const triggerGalleryInput = () => {
    setOpenDialog(false);
    if (fileInputRef.current) {
      try {
        fileInputRef.current.click();
      } catch (error) {
        console.error("Error triggering file input:", error);
      }
    }
  };

  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      <FormControl>
        <div>
          {/* Главное поле ввода файлов (будет скрыто и активировано через кнопку) */}
          <Input
            className={className}
            onChange={(event) => handleChange(event.target.files?.[0])}
            type="file"
            accept={acceptsMap[type]}
            id={id}
            ref={fileInputRef}
            onClick={handleChooseFileClick}
            disabled={isLoading}
          />
          
          {/* Скрытое поле для камеры */}
          <Input
            className="hidden"
            onChange={(event) => handleChange(event.target.files?.[0])}
            type="file"
            accept={acceptsMap[type]}
            capture="environment"
            ref={cameraInputRef}
          />
          
          {/* Диалог выбора источника */}
          <Dialog open={openDialog} onOpenChange={setOpenDialog}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogTitle>Select Source</DialogTitle>
              <DialogDescription>
                Where would you like to upload the image from?
              </DialogDescription>
              <div className="grid gap-4 py-4">
                <Button 
                  onClick={triggerCameraInput}
                  className="w-full"
                >
                  Take Photo with Camera
                </Button>
                <Button 
                  onClick={triggerGalleryInput}
                  variant="outline"
                  className="w-full"
                >
                  Choose from Gallery
                </Button>
              </div>
              <DialogClose className="absolute right-4 top-4" />
            </DialogContent>
          </Dialog>
          
          {isLoading && (
            <div className="text-sm text-blue-500 mt-1">
              Processing image...
            </div>
          )}
        </div>
      </FormControl>
      <FormMessage />
    </FormItem>
  );
}
