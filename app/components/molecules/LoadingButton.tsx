import { Button } from "../ui/button";
import { Spinner } from "../atoms/Spinner";

import type { JSX } from "react";

export function LoadingButton({
  loading,
  children,
}: {
  loading: boolean;
  children: JSX.Element | string;
}) {
  return (
    <Button type="submit">
      {loading ? <Spinner size={20} /> : <>{children}</>}
    </Button>
  );
}
