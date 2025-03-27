import { Button } from "../ui/button";
import { Spinner } from "../atoms/Spinner";

import type { JSX } from "react";
import { ButtonProps } from "../ui/button";

export function LoadingButton({
  loading,
  children,
  ...props
}: {
  loading: boolean;
  children: JSX.Element | string;
} & ButtonProps) {
  return (
    <Button {...props}>
      {loading ? <Spinner size={20} /> : <>{children}</>}
    </Button>
  );
}
