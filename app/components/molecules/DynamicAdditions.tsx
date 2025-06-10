import { CUSTOMER_ITEMS } from "~/utils/constants";
import { Input } from "~/components/ui/input";
import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
  SelectItem,
} from "~/components/ui/select";

const DynamicAddition = ({ item }: { item: keyof typeof CUSTOMER_ITEMS }) => {
  const [values, setValues] = useState<Record<string, string>>({});
  const context = CUSTOMER_ITEMS[item];

  return (
    <div className="flex gap-2">
      <h2>{item}</h2>
      {Object.entries(context).map(([key, value]) => {
        if (typeof value === "object") {
          return (
            <Select
              value={values[key]}
              onValueChange={(value) => {
                setValues((prev) => ({ ...prev, [key]: value }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a value" />
                <SelectContent>
                  {Object.entries(value.prices).map(([key, value]) => (
                    <SelectItem key={key} value={key}>
                      {key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </SelectTrigger>
            </Select>
          );
        }
        return (
          <Input
            value={values[key]}
            onChange={(e) => {
              setValues((prev) => ({ ...prev, [key]: e.target.value }));
            }}
          />
        );
      })}
    </div>
  );
};

export const DynamicAdditions = ({
  selectedItems,
}: {
  selectedItems: string[];
}) => {
  return (
    <div>
      {selectedItems.map((item) => (
        <DynamicAddition key={item} item={item} />
      ))}
    </div>
  );
};
