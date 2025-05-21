import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "use-debounce";
import {
  Popover,
  PopoverContent,
  PopoverAnchor, // ⇦ вместо PopoverTrigger
} from "~/components/ui/popover";
import { Command, CommandItem, CommandGroup } from "~/components/ui/command";
import { Input } from "~/components/ui/input";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { useState } from "react";

async function completeAddress(
  q: string
): Promise<{ description: { text: string }; place_id: string }[]> {
  const res = await fetch(
    `/api/google/address-complete?q=${encodeURIComponent(q)}`
  );
  if (!res.ok) throw new Error("Failed to fetch address");
  const data = await res.json();
  return data["suggestions"];
}

type Props = {
  form: any;
  field: string; // имя поля формы
};

export function AddressInput({ form, field }: Props) {
  const [open, setOpen] = useState(false);

  const value = form.watch(field) as string;
  const [debounced] = useDebounce(value, 300);

  const { data = [], isFetching } = useQuery({
    queryKey: ["google", "address", debounced],
    queryFn: () => completeAddress(debounced),
    enabled: debounced?.length >= 8,
    staleTime: 60_000,
  });

  return (
    <FormField
      control={form.control}
      name={field}
      render={({ field: rhf }) => (
        <FormItem>
          <FormLabel>
            {field === "billing_address"
              ? "Billing Address"
              : "Project Address"}
          </FormLabel>
          <FormControl>
            <Input
              placeholder={`Enter ${
                field === "billing_address" ? "billing" : "project"
              } address (min 10 characters)`}
              value={rhf.value}
              onChange={(e) => {
                rhf.onChange(e);
                setOpen(true); // показываем список при вводе
              }}
              onFocus={() => rhf.value && setOpen(true)}
              onBlur={() => {
                rhf.onBlur();
                setTimeout(() => setOpen(false), 200);
              }}
            />
          </FormControl>
          <FormMessage />

          {open && (
            <Command className="mt-1 border rounded-md shadow-md">
              <CommandGroup heading={isFetching ? "Searching…" : "Suggestions"}>
                {data.map((s) => (
                  <CommandItem
                    key={s.place_id}
                    onSelect={() => {
                      form.setValue(field, s.description.text, {
                        shouldValidate: true,
                        shouldDirty: true,
                      });
                      requestAnimationFrame(() => setOpen(false));
                    }}
                  >
                    {s.description.text}
                  </CommandItem>
                ))}
              </CommandGroup>
            </Command>
          )}
        </FormItem>
      )}
    />
  );
}
