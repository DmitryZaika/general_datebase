import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Button } from "../ui/button";

export const DialogFullHeader = ({ children }: { children: JSX.Element }) => {
  return (
    <DialogHeader>
      <div className="bg-gray-100 text-gray-800 font-semibold text-lg py-3 px-4 border border-gray-300 flex justify-between items-center">
        <DialogTitle>{children}</DialogTitle>
        <DialogClose>
          <Button
            variant="ghost"
            aria-label="Close"
            size="icon"
            className="text-2xl"
          >
            ✕
          </Button>
        </DialogClose>
      </div>
    </DialogHeader>
  );
};
