import { v4 as uuidv4 } from "uuid";

export interface ToastMessage {
  nonce: string;
  variant: "default" | "destructive" | "success";
  description: string;
  title: string;
}

export function toastData(
  title: string,
  description: string,
  variant: string = "success"
) {
  return {
    nonce: uuidv4(),
    variant,
    description,
    title,
  };
}
