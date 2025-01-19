import { FormControl, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";

export function SwitchItem({ name, field }: { name: string; field: any }) {
  return (
    <FormItem>
      <FormControl>
        <Switch checked={field.value} onCheckedChange={field.onChange} />
      </FormControl>
      <FormLabel>{name}</FormLabel>
      <FormMessage />
    </FormItem>
  );
}
