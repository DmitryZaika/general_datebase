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
  type: string;
  setImage: (value: undefined | number) => void;
}

function ChildrenImagesDialog({
  src,
  name,
  alt,
  isOpen,
  id,
  type,
  setImage,
}: ImageProps) {
  const [data, setData] = useState<
    { images: { id: number; url: string }[] } | undefined
  >();
  const [selectedImage, setSelectedImage] = useState<string | null>(src);
  const [thumbnailApi, setThumbnailApi] = useState<CarouselApi>();

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
    fetch(`/api/installed_${type}/${id}`)
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
      <div className=" w-full">
        <img
          src={selectedImage || "/path/to/placeholder.png"}
          alt={alt || name || "Image"}
          className="w-full h-[85vh] md:h-[87vh]  2xl:h-[93vh] object-contain z-0"
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {data?.images && data.images.length > 0 && (
        <div className="w-screen max-w-full ">
          <Carousel
            className=" flex justify-center items-center w-full  pl-10 pr-10"
            setApi={setThumbnailApi}
            opts={{
              slidesToScroll: 5,
              align: "start",
            }}
          >
            <CarouselContent onMouseLeave={handleMouseLeaveContainer}>
              {data.images.map((image) => (
                <CarouselItem
                  key={image.id}
                  className="basis-auto max-w-fit pl-2"
                >
                  <img
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
                </CarouselItem>
              ))}
            </CarouselContent>
            {data?.images && data.images.length >= 7 && (
              <>
                <CarouselPrevious className="h-8 w-8 left-0 top-5" />
                <CarouselNext className="h-8 w-8 right-0 top-5" />
              </>
            )}
          </Carousel>
        </div>
      )}
    </>
  );
}

export function SuperCarousel({
  currentId,
  setCurrentId,
  images,
  type,
}: {
  images: { id: number; url: string | null }[];
  currentId?: number;
  setCurrentId?: (value: number | undefined) => void;
  type: string;
}) {
  const [api, setApi] = useState<CarouselApi>();
  const _ = useArrowCarousel(api);

  useEffect(() => {
    if (!api) return;
    if (currentId !== undefined) {
      const index = images.findIndex(({ id }) => id === currentId);
      if (index !== -1) {
        api.scrollTo(index, true);
      }
    }
    api.on("settle", (index) => {
      const slidesInView = api.slidesInView();
      if (slidesInView.length > 0) {
        setCurrentId?.(images[slidesInView[0]].id);
      }
    });
  }, [api, currentId, images, setCurrentId]);

  return (
    <Dialog
      open={currentId !== undefined}
      onOpenChange={(open) => !open && setCurrentId?.(undefined)}
    >
      <DialogContent
        closeClassName="z-50 top-40 sm:top-10 md:top-25 lg:top-10 right-0 sm:-right-15 md:-right-25 lg:-right-35"
        className="flex flex-col justify-center items-center gap-3 bg-transparent"
      >
        <DialogTitle className="sr-only">Image Gallery</DialogTitle>
        <DialogDescription className="sr-only">Image Gallery</DialogDescription>
        <Carousel
          className="max-w-screen max-h-screen w-screen h-screen lg:max-w-[90vw] 2xl:max-w-[60vw]"
          setApi={setApi}
          opts={{
            dragFree: false,
          }}
        >
          <CarouselContent>
            {images.map(({ id, url }) => (
              <CarouselItem key={id}>
                <ChildrenImagesDialog
                  type={type}
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
