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
    if (open === false) {
      setImage(undefined);
    }
  };

  return (
    <div className="flex  gap-2 flex-col items-center ">
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild onClick={() => setImage(id)}>
          <img
            src={src || "/path/to/placeholder.png"}
            alt={alt || name || "Image"}
            className={`object-cover w-40 h-40 border-2 border-blue-500 rounded cursor-pointer transition duration-200 ease-in-out transform hover:scale-[105%] hover:shadow-lg select-none hover:border-blue-500 hover:bg-gray-300 ${className}`}
            loading="lazy"
          />
        </DialogTrigger>
        <DialogContent className="p-0 bg-transparent">
          <img
            src={src || "/path/to/placeholder.png"}
            alt={alt || name || "Image"}
            className="w-auto h-full max-w-full max-h-screen mx-auto my-auto"
            onClick={(e) => e.stopPropagation()}
          />
        </DialogContent>
      </Dialog>
      <p className="text-center font-bold font-sans">{name}</p>
    </div>
  );
}
