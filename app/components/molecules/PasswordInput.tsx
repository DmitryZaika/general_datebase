"use client";

import * as React from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { FormControl, FormItem, FormLabel, FormMessage } from "../ui/form";

import { Button } from "~/components/ui/button";
import { Input, type InputProps } from "../ui/input";
import { cn } from "~/lib/utils";

const PasswordInput = React.forwardRef<
  HTMLInputElement,
  InputProps & { field: object }
>(({ className, field, ...props }, ref) => {
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <FormItem>
      <FormLabel>Password</FormLabel>
      <FormControl>
        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            className={cn("hide-password-toggle pr-10", className)}
            ref={ref}
            {...field}
            {...props}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent z-40"
            onClick={() => setShowPassword((prev) => !prev)}
          >
            {showPassword ? (
              <EyeIcon className="h-4 w-4" aria-hidden="true" />
            ) : (
              <EyeOffIcon className="h-4 w-4" aria-hidden="true" />
            )}
            <span className="sr-only">
              {showPassword ? "Hide password" : "Show password"}
            </span>
          </Button>

          {/* hides browsers password toggles */}
          <style>{`
					.hide-password-toggle::-ms-reveal,
					.hide-password-toggle::-ms-clear {
						visibility: hidden;
						pointer-events: none;
						display: none;
					}
				`}</style>
        </div>
      </FormControl>
      <FormMessage />
    </FormItem>
  );
});
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };