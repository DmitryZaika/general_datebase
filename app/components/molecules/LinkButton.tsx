import { LoadingButton } from "./LoadingButton";
import { ButtonHTMLAttributes, useEffect, useState } from "react";
import { useNavigation } from "react-router";


export function LinkButton({
  onClick,
  ...props
}:  ButtonHTMLAttributes<HTMLButtonElement>) {
  const { state } = useNavigation();
  const [loading, setLoading] = useState(false);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {   
    setLoading(true);
    onClick?.(e);
  }

  useEffect(() => {
    if (state === "idle") {
      setLoading(false);
    }
  }, [state]);

  return (
    <LoadingButton loading={loading} onClick={handleClick} {...props} />
  );
}
