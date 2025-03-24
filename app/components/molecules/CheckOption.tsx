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
  const id = `checkbox-${value as string}`;
  
  return (
    <div className="items-to flex space-x-2">
      <Checkbox
        className="cursor-pointer"
        id={id}
        checked={selected}
        onCheckedChange={() => toggleValue(value)}
      />
      <div className="grid gap-1.5 leading-none capitalize">
        <label
          htmlFor={id}
          className="text-sm font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {value as string}
        </label>
      </div>
    </div>
  );
}
