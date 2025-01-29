// Image.tsx
import * as React from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContentImage,
} from "~/components/ui/dialog";
import { X } from "lucide-react";

interface ImageProps {
  name?: string;
  src: string | null;
  alt?: string;
  className?: string;
  isOpen: boolean;
  id: number;
  setImage: (value: undefined | number) => void;
}

export function Image({
  className = "",
  src,
  name,
  alt,
  isOpen,
  id,
  setImage,
}: ImageProps) {
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setImage(undefined);
    }
  };

  const handleClose = () => {
    setImage(undefined);
  };

  return (
    <div className="flex gap-2 flex-col items-center">
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <img
            src={src || "/path/to/placeholder.png"}
            alt={alt || name || "Image"}
            className={`object-cover w-40 h-40 border-2 border-blue-500 rounded cursor-pointer transition duration-200 ease-in-out transform hover:scale-[110%] hover:shadow-lg select-none hover:border-blue-500 hover:bg-gray-300 ${className}`}
            loading="lazy"
            onClick={() => setImage(id)}
          />
        </DialogTrigger>

        <DialogContentImage className="flex justify-center items-center">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75 transition"
            aria-label="Закрыть"
          >
            <X className="w-6 h-6" />
          </button>

          <img
            src={src || "/path/to/placeholder.png"}
            alt={alt || name || "Image"}
            className="h-[90vh] w-auto max-h-[90vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </DialogContentImage>
      </Dialog>
      <p className="text-center font-bold font-sans">{name}</p>
    </div>
  );
}
