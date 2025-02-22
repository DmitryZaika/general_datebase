import { X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "~/components/ui/carousel";
import { Dialog, DialogContent } from "~/components/ui/dialog";
import { useArrowCarousel } from "~/hooks/useArrowToggle";

interface ImageProps {
  name?: string;
  src: string | null;
  alt?: string;
  className?: string;
  isOpen: boolean;
  id: number;
  setImage: (value: undefined | number) => void;
}

function ChildrenImagesDialog({
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
    <>
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 cursor-pointer text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-75 transition"
        aria-label="Close"
      >
        <X className="w-6 h-6 " />
      </button>

      <div className="flex-1 flex items-center justify-center w-full">
        <img
          src={selectedImage || "/path/to/placeholder.png"}
          alt={alt || name || "Image"}
          className="w-auto object-contain"
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
    </>
  );
}

export function SuperCarousel({
  currentId,
  setCurrentId,
  images,
}: {
  images: { id: number; url: string | null }[];
  currentId?: number;
  setCurrentId: (value: number | undefined) => void;
}) {
  const [api, setApi] = useState<CarouselApi>();
  const _ = useArrowCarousel(api);

  useEffect(() => {
    if (api && currentId !== undefined) {
      const index = images.findIndex(({ id }) => id === currentId);
      api.scrollTo(index, true);
    }
  });
  return (
    <Dialog
      open={currentId !== undefined}
      onOpenChange={(open) => !open && setCurrentId(undefined)}
    >
      <DialogContent className="flex flex-col justify-between items-center bg-transparent h-screen w-screen p-4">
        <Carousel className="w-full" setApi={setApi}>
          <CarouselContent>
            {images.map(({ id, url }) => (
              <CarouselItem key={id}>
                <ChildrenImagesDialog
                  src={url}
                  id={id}
                  isOpen={currentId === id}
                  setImage={setCurrentId}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      </DialogContent>
    </Dialog>
  );
}
