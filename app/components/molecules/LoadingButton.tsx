import { Button } from "../ui/button";
import { Spinner } from "../atoms/Spinner";
import { ButtonHTMLAttributes } from "react";

interface LoadingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading: boolean;
}

export function LoadingButton({
  loading,
  children,
  ...props
}: LoadingButtonProps) {
  return (
      <Button {...props} type="submit">
      {loading ? <Spinner size={20} /> : <>{children}</>}
    </Button>
  );
}
