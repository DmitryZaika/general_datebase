import { cn } from "~/lib/utils";

interface IProps extends React.HTMLProps<HTMLSpanElement> {
  children: React.ReactNode;
}

export const LinkSpan = ({ children, className, ...props }: IProps) => (
  <span className={cn("text-blue-500 underline cursor-pointer", className )} {...props}>
    {children}
  </span>
)
