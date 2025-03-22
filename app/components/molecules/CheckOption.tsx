import { Checkbox } from "~/components/ui/checkbox";
interface ICheckOptionProps<T> {
  value: T;
  selected: boolean;
  toggleValue: (val: T) => void;
}

export function CheckOption<T>({
  value,
  selected,
  toggleValue,
}: ICheckOptionProps<T>) {
  return (
    <div className="items-top flex space-x-2">
      <Checkbox
        id="terms1"
        checked={selected}
        onCheckedChange={() => toggleValue(value)}
      />
      <div className="grid gap-1.5 leading-none capitalize">
        <label
          htmlFor="terms1"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {value as string}
        </label>
      </div>
    </div>
  );
}
