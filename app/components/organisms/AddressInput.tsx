import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "use-debounce";
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

async function completeAddress(q: string): Promise<
  {
    description: { text: string };
    place_id: string;
    zip_code: string | null;
  }[]
> {
  const res = await fetch(
    `/api/google/address-complete?q=${encodeURIComponent(q)}`
  );
  if (!res.ok) throw new Error("Failed to fetch address");
  const data = await res.json();
  return data["suggestions"];
}

type Props = {
  form: any;
  field: string;
  zipField?: string;
};

export function AddressInput({ form, field, zipField }: Props) {
  const [open, setOpen] = useState(false);

  const value = form.watch(field) as string;
  const [debounced] = useDebounce(value, 300);

  const { data = [], isFetching } = useQuery({
    queryKey: ["google", "address", debounced],
    queryFn: () => completeAddress(debounced),
    enabled: debounced?.length >= 6,
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
              value={
                zipField
                  ? rhf.value?.replace("USA", form.watch(zipField) ?? "")
                  : rhf.value
              }
              onChange={(e) => {
                rhf.onChange(e);
                setOpen(true);
              }}
              onFocus={() => rhf.value && setOpen(true)}
              onBlur={() => {
                rhf.onBlur();
                setTimeout(() => setOpen(false), 200);
              }}
              onKeyDown={(e) => {
                if (e.key === "Tab" && open && data.length > 0) {
                  e.preventDefault();
                  form.setValue(field, data[0].description.text, {
                    shouldValidate: true,
                    shouldDirty: true,
                  });
                  setOpen(false);
                }
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
                      if (zipField) {
                        form.setValue(zipField, s.zip_code ?? "", {
                          shouldValidate: true,
                          shouldDirty: true,
                        });
                      }
                      requestAnimationFrame(() => setOpen(false));
                    }}
                  >
                    {s.description.text.replace("USA", s.zip_code ?? "")}
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
