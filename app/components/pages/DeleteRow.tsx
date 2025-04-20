import { Form, useLoaderData } from "react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";

interface IProps {
  handleChange: (open: boolean) => void;
  title: string;
  description: string;
}

export const DeleteRow = ({ handleChange, title, description }: IProps) => {

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>
        <Form id="customerForm" method="post">
          <DialogFooter>
            <AuthenticityTokenInput />
            <Button autoFocus type="submit">
              Confirm
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

