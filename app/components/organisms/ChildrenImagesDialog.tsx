import * as React from "react";
import { Dialog, DialogTrigger, DialogContent } from "~/components/ui/dialog";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

interface ImageProps {
  name?: string;
  src: string | null;
  alt?: string;
  className?: string;
  isOpen: boolean;
  id: number;
  setImage: (value: undefined | number) => void;
}

export function ChildrenImagesDialog({
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

  const [data, setData] = useState<
    { images: { id: number; url: string }[] } | undefined
  >();
  const [hoveredImage, setHoveredImage] = useState<string | null>(null);

  const getTodos = () => {
    fetch(`/api/installed_stones/${id}`)
      .then(async (res) => await res.json())
      .then(setData);
  };

  useEffect(() => {
    if (isOpen) {
      getTodos();
    }
  }, [isOpen]);

  return (
    <div className="flex gap-2 flex-col items-center">
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <img
            src={src || "/path/to/placeholder.png"}
            alt={alt || name || "Image"}
            className={`object-cover w-40 h-40 border-2 border-blue-500 rounded cursor-pointer transition duration-200 ease-in-out transform hover:scale-[105%] hover:shadow-lg select-none hover:border-blue-500 hover:bg-gray-300 ${className}`}
            loading="lazy"
            onClick={() => setImage(id)}
          />
        </DialogTrigger>

        <DialogContent className="flex justify-around items-center flex-col">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75 transition"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>

          <img
            src={hoveredImage || src || "/path/to/placeholder.png"}
            alt={alt || name || "Image"}
            className="w-auto max-h-[85vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <div
            className="flex justify-center overflow-auto w-full gap-1"
            onMouseLeave={() => setHoveredImage(null)}
          >
            {data?.images.map((image) => (
              <img
                key={image.id}
                src={image.url}
                className="size-15 cursor-pointer"
                alt={name || "Image"}
                onMouseEnter={() => setHoveredImage(image.url)}
                onClick={() => window.open(image.url, "_blank")}
                onAuxClick={(e) => {
                  e.preventDefault();
                  window.open(image.url, "_blank");
                }}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>
      {name && <p className="text-center font-bold font-sans">{name}</p>}
    </div>
  );
}
