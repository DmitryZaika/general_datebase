import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogClose,
} from "~/components/ui/dialog";
import { X } from "lucide-react";

interface ImageProps {
  name?: string;
  src: string | null;
  alt?: string;
  className?: string;
}

export function Image({ className = "", src, name, alt }: ImageProps) {
  return (
    <div className="flex flex-col items-center">
      <Dialog>
        <DialogTrigger asChild>
          <img
            src={src || "/path/to/placeholder.png"}
            alt={alt || name || "Image"}
            className={`w-full h-auto border-2 border-blue-500 rounded cursor-pointer transition duration-300 ease-in-out transform hover:scale-105 hover:shadow-lg hover:border-blue-500 hover:bg-gray-300 ${className}`}
            loading="lazy"
          />
        </DialogTrigger>
        <DialogContent className="p-0 bg-transparent">
          <DialogClose asChild>
            <button
              className="absolute top-4 right-4 text-white"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
          </DialogClose>
          <img
            src={src || "/path/to/placeholder.png"}
            alt={alt || name || "Image"}
            className="w-auto h-auto max-w-full max-h-screen mx-auto my-auto"
            onClick={(e) => e.stopPropagation()}
          />
        </DialogContent>
      </Dialog>
      <p className="text-center font-bold select-text">{name}</p>
    </div>
  );
}
