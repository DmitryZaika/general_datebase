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
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
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
  }, [isOpen, src, id]);

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
      <div className="flex-1 flex items-center justify-center w-full">
        <img
          src={selectedImage || "/path/to/placeholder.png"}
          alt={alt || name || "Image"}
          className="w-full h-[90vh] object-contain z-0"
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      <div
        className="flex justify-center overflow-x-auto max-w-full h-[60px] overflow-y-hidden md:overflow-hidden w-screen pb-10 gap-2"
        onMouseLeave={handleMouseLeaveContainer}
      >
        {data?.images.map((image) => (
          <img
            key={image.id}
            src={image.url}
            className="w-10 h-10  cursor-pointer"
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
    if (!api) return;
    if (currentId !== undefined) {
      const index = images.findIndex(({ id }) => id === currentId);
      api.scrollTo(index, true);
    }
    api.on("settle", (index) => {
      const slidesInView = api.slidesInView();
      setCurrentId(images[slidesInView[0]].id);
      console.log(currentId, "idd");
    });
  }, [api]);
  return (
    <Dialog
      open={currentId !== undefined}
      onOpenChange={(open) => !open && setCurrentId(undefined)}
    >
      <DialogContent
        closeClassName="z-50  top-40 sm:top-10 md:top-25 lg:top-10 right-0 sm:-right-15 md:-right-25  lg:-right-35"
        className=" flex flex-col justify-center items-center gap-3 bg-transparent"
      >
        <DialogTitle className="sr-only">Image Gallery</DialogTitle>
        <DialogDescription className="sr-only">Image Gallery</DialogDescription>
        <Carousel
          className="max-w-screen lg:max-w-[90vw]  2xl:max-w-[60vw]  "
          setApi={setApi}
          opts={{
            dragFree: false,
          }}
        >
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
