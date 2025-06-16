import { CUSTOMER_ITEMS } from "~/utils/constants";
import { Input } from "~/components/ui/input";
import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
  SelectItem,
} from "~/components/ui/select";
import { Button } from "~/components/ui/button";
import { X } from "lucide-react";
import { Label } from "@radix-ui/react-label";

type ExtraItemKey = keyof typeof CUSTOMER_ITEMS;

const getValueKey = (itemKey: string) => {
  switch (itemKey) {
    case "tripFee":
      return "miles";
    case "mitter_edge_price":
      return "amount";
    case "oversize_piece":
      return "sqft";
    case "ten_year_sealer":
      return "amount";
    default:
      return "value";
  }
};

interface DynamicAdditionProps {
  itemKey: ExtraItemKey;
  itemData: any;
  onRemove: (key: ExtraItemKey) => void;
  onUpdate: (key: ExtraItemKey, data: any) => void;
}

const DynamicAddition = ({
  itemKey,
  itemData,
  onRemove,
  onUpdate,
}: DynamicAdditionProps) => {
  const context = CUSTOMER_ITEMS[itemKey] as any;
  const inputwidth = "min-w-[115px]";
  const [isPriceManuallySet, setIsPriceManuallySet] = useState(false);

  const valueKey = getValueKey(itemKey);
  const value = typeof itemData === "object" ? itemData[valueKey] ?? "" : "";
  const price = typeof itemData === "object" ? itemData.price ?? 0 : itemData ?? 0;

  useEffect(() => {
    if (isPriceManuallySet) return;

    let newPrice = 0;

    if (itemKey === "tripFee") {
      const miles = parseFloat(value) || 0;
      newPrice = context.priceFn({ miles });
    } else if (itemKey === "oversize_piece") {
      if (value && context.sqft && context.sqft[value] !== undefined) {
        newPrice = context.sqft[value];
      }
    } else if (itemKey === "mitter_edge_price") {
      const amount = parseFloat(value) || 0;
      newPrice = context.priceFn({ amount });
    } else if (itemKey === "ten_year_sealer") {
      const amount = parseFloat(value) || 0;
      newPrice = context.priceFn({ amount });
    }

    if (newPrice !== price) {
      onUpdate(itemKey, { ...itemData, [valueKey]: value, price: newPrice });
    }
  }, [value, itemKey, context, price, isPriceManuallySet]);

  const handleValueChange = (newValue: string) => {
    setIsPriceManuallySet(false);
    const newData = { ...itemData, [valueKey]: newValue, price };
    onUpdate(itemKey, newData);
  };

  const handlePriceChange = (newPrice: number) => {
    setIsPriceManuallySet(true);
    onUpdate(itemKey, { ...itemData, [valueKey]: value, price: newPrice });
  };

  const renderControl = () => {
    if (itemKey === "oversize_piece") {
      const options = context.sqft as Record<string, number>;
      return (
        <div className="min-w-[100px]">
          <Label className="text-xs">Sqft</Label>
          <Select value={value} onValueChange={handleValueChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(options).map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    const label = itemKey === "tripFee" ? "Miles" : "Amount";

    if (itemKey === "ten_year_sealer") {
      return (
        <div className={inputwidth}>
          <Label className="text-xs">Square Feet</Label>
          <Input value={value} disabled={true} />
        </div>
      );
    }

    return (
      <div className={inputwidth}>
        <Label className="text-xs">{label}</Label>
        <Input
          value={value}
          onChange={(e) => handleValueChange(e.target.value)}
        />
      </div>
    );
  };

  return (
    <div className="p-2 rounded-md mb-2 ">
      <div className="flex items-start gap-2">
        <div className="min-w-[120px] flex-shrink-0">
          <div className="h-6"></div>
          <span className="font-medium text-sm capitalize">
            {itemKey.replaceAll("_", " ")}
          </span>
        </div>
        {renderControl()}
        <div className={inputwidth}>
          <Label className="text-xs">Price</Label>
          <Input
            value={price !== 0 ? price : ""}
            onChange={(e) => handlePriceChange(parseFloat(e.target.value) || 0)}
          />
        </div>
        <div className="flex flex-col">
          <div className="h-6"></div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 p-0"
            onClick={() => onRemove(itemKey)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

interface DynamicAdditionsProps {
  items: Record<ExtraItemKey, any>;
  onUpdate: (items: Record<ExtraItemKey, any>) => void;
  onRemove: (key: ExtraItemKey) => void;
}

export const DynamicAdditions = ({ items, onUpdate, onRemove }: DynamicAdditionsProps) => {
  const selectedItems = Object.keys(items) as ExtraItemKey[];
  if (selectedItems.length === 0) return null;

  const updateItem = (key: ExtraItemKey, data: any) => {
    onUpdate({ ...items, [key]: data });
  };

  return (
    <div className="mt-4 space-y-2">
      <h3 className="text-sm font-semibold text-gray-600">Extra Items</h3>
      {selectedItems.map((itemKey) => (
        <DynamicAddition
          key={itemKey}
          itemKey={itemKey}
          itemData={items[itemKey]}
          onRemove={onRemove}
          onUpdate={updateItem}
        />
      ))}
    </div>
  );
};
