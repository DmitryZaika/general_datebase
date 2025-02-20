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
  const [data, setData] = useState<
    { images: { id: number; url: string }[] } | undefined
  >();
  const [selectedImage, setSelectedImage] = useState<string | null>(src);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setImage(undefined);
    }
  };

  const handleClose = () => {
    setImage(undefined);
  };

  useEffect(() => {
    if (isOpen) {
      getImages();
      setSelectedImage(src);
    }
  }, [isOpen, src]);

  const getImages = () => {
    fetch(`/api/installed_stones/${id}`)
      .then(async (res) => await res.json())
      .then(setData);
  };

  const handleMouseEnter = (imageUrl: string) => {
    setSelectedImage(imageUrl);
  };

  const handleMouseLeaveContainer = () => {
    setSelectedImage(src);
  };

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

        <DialogContent className="flex flex-col justify-between items-center bg-transparent h-screen p-4">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75 transition"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex-1 flex items-center justify-center w-full">
            <img
              src={selectedImage || "/path/to/placeholder.png"}
              alt={alt || name || "Image"}
              className="w-auto max-h-[85vh] max-w-[100vw] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div
            className="flex justify-center overflow-x-auto overflow-y-hidden md:overflow-hidden w-screen gap-1"
            onMouseLeave={handleMouseLeaveContainer}
          >
            {data?.images.map((image) => (
              <img
                key={image.id}
                src={image.url}
                className="w-10 h-10 cursor-pointer"
                alt={name || "Image"}
                onClick={() => setSelectedImage(image.url)}
                onMouseEnter={() => handleMouseEnter(image.url)}
                onAuxClick={(e) => {
                  if (e.button === 1) {
                    e.preventDefault();
                    window.open(image.url, "_blank");
                  }
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
