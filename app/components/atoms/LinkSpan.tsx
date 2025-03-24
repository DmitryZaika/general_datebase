import { cn } from "~/lib/utils";

interface IProps extends React.HTMLProps<HTMLSpanElement> {
  children: React.ReactNode;
  isSelected?: boolean;
  variant?: 'default' | 'blue';
}

export const LinkSpan = ({ children, className, isSelected, variant = 'default', ...props }: IProps) => (
  <span 
    className={cn(
      "cursor-pointer transition-colors duration-300",
      variant === 'default' && [
        "text-zinc-900 dark:text-zinc-50",
        "hover:text-blue-500",
        isSelected && "text-blue-500 hover:text-blue-500"
      ],
      variant === 'blue' && "text-blue-500 hover:text-blue-600",
      className
    )} 
    aria-current={isSelected ? "page" : undefined}
    {...props}
  >
    {children}
  </span>
);
