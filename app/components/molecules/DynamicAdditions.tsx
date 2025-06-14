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

interface DynamicAdditionProps {
  itemKey: ExtraItemKey;
  onRemove: (key: ExtraItemKey) => void;
  onPriceChange: (key: ExtraItemKey, price: number) => void;
  onValueChange: (key: ExtraItemKey, value: string) => void;
  price: number;
  value: string;
}

const DynamicAddition = ({
  itemKey,
  onRemove,
  onPriceChange,
  onValueChange,
  price,
  value,
}: DynamicAdditionProps) => {
  const context = CUSTOMER_ITEMS[itemKey] as any;
  const inputwidth = "min-w-[115px]";
  const [isPriceManuallySet, setIsPriceManuallySet] = useState(false);

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
    }

    if (newPrice !== price) {
      onPriceChange(itemKey, newPrice);
    }
  }, [value, itemKey, context, price, onPriceChange, isPriceManuallySet]);

  const handleValueChange = (newValue: string) => {
    setIsPriceManuallySet(false); // Re-enable auto-calculation
    onValueChange(itemKey, newValue);
  };

  const handlePriceChange = (newPrice: number) => {
    setIsPriceManuallySet(true); // Disable auto-calculation
    onPriceChange(itemKey, newPrice);
  };

  const renderControl = () => {
    if (itemKey === "oversize_piece") {
      const options = context.sqft as Record<string, number>;
      return (
        <div className={`${inputwidth}`}>
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
  selectedItems: ExtraItemKey[];
  onRemove: (key: ExtraItemKey) => void;
  onUpdate: (
    items: Record<ExtraItemKey, { value: string; price: number }>
  ) => void;
  items: Record<ExtraItemKey, { value: string; price: number }>;
}

export const DynamicAdditions = ({
  selectedItems,
  onRemove,
  onUpdate,
  items,
}: DynamicAdditionsProps) => {
  if (!selectedItems || selectedItems.length === 0) return null;

  const handlePriceChange = (key: ExtraItemKey, price: number) => {
    onUpdate({ ...items, [key]: { ...items[key], price } });
  };

  const handleValueChange = (key: ExtraItemKey, value: string) => {
    onUpdate({ ...items, [key]: { ...items[key], value } });
  };

  const handleRemove = (key: ExtraItemKey) => {
    onRemove(key); // This will trigger re-render and items will be updated from parent
  };

  return (
    <div className="mt-4 space-y-2">
      <h3 className="text-sm font-semibold text-gray-600">Extra Items</h3>
      {selectedItems.map((itemKey) => (
        <DynamicAddition
          key={itemKey}
          itemKey={itemKey}
          onRemove={handleRemove}
          onPriceChange={handlePriceChange}
          onValueChange={handleValueChange}
          price={items[itemKey]?.price || 0}
          value={items[itemKey]?.value || ""}
        />
      ))}
    </div>
  );
};
