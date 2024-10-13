import { useState } from "react";

export default function SpecialOrder() {
  const [price, setPrice] = useState<number | undefined>();
  const [width, setWidth] = useState<number | undefined>();
  const [length, setLength] = useState<number | undefined>();
  const [slabs, setSlabs] = useState(1);

  const taxRate = 0.07;

  const minusSlab = () => {
    if (slabs > 1) {
      setSlabs(slabs - 1);
    }
  };

  function calculateTotal() {
    const areaPerSlab = ((width || 0) * (length || 0)) / 144;
    const totalSquareFeet = areaPerSlab * slabs;
    const materialCost = areaPerSlab * (price || 0) * slabs * (1 + taxRate);

    const deliveryFee = slabs * 30;
    const totalCost = materialCost + deliveryFee;

    const costPerSqftWithDelivery = totalCost / totalSquareFeet;

    return {
      totalSquareFeet: isFinite(totalSquareFeet)
        ? totalSquareFeet.toFixed(2)
        : "0.00",
      totalCost: width && length && price ? totalCost.toFixed(2) : "0.00",
      totalPrice: isFinite(costPerSqftWithDelivery)
        ? costPerSqftWithDelivery.toFixed(2)
        : "0.00",
    };
  }
  const values = calculateTotal();

  return (
    <main>
      <h1 className="text-2xl mb-5 text-center">Special Order Calculator</h1>
      <div className="bg-white p-5 rounded-lg shadow-md max-w-lg mx-auto my-5">
        <label htmlFor="price-per-sqft" className="text-base mb-2 block">
          Price per Sqft:
        </label>
        <input
          type="number"
          id="price-per-sqft"
          placeholder="Enter price per sqft"
          value={price === undefined ? "" : price}
          onChange={(e) => setPrice(parseInt(e.target.value))}
          className="w-full p-2 border border-gray-300 rounded-md text-base mb-4"
        />

        <label htmlFor="size" className="text-base mb-2 block">
          Size of Slab:
        </label>
        <div className="flex gap-2 mb-4">
          <input
            type="number"
            id="width"
            placeholder="Width (inches)"
            min="0"
            value={width === undefined ? "" : width}
            onChange={(e) => setWidth(parseInt(e.target.value))}
            className="w-1/2 p-2 border border-gray-300 rounded-md text-base"
          />
          <input
            type="number"
            id="length"
            placeholder="Length (inches)"
            min="0"
            value={length === undefined ? "" : length}
            onChange={(e) => setLength(parseInt(e.target.value))}
            className="w-1/2 p-2 border border-gray-300 rounded-md text-base"
          />
        </div>

        <div className="flex items-center gap-10 mb-4">
          <label htmlFor="slabs" className="text-base">
            Slabs:
          </label>
          <button
            className="select-none bg-gray-800 text-yellow-400 border-none py-2 px-3 text-xl rounded-md cursor-pointer"
            type="button"
            id="decrease-slabs"
            onClick={minusSlab}
          >
            -
          </button>
          <span id="slabs-amount" className="text-lg font-bold">
            {slabs}
          </span>
          <button
            className="select-none bg-gray-800 text-yellow-400 border-none py-2 px-3 text-xl rounded-md cursor-pointer"
            type="button"
            id="increase-slabs"
            onClick={() => setSlabs(slabs + 1)}
          >
            +
          </button>
        </div>

        <div className="text-lg mt-5 font-bold text-gray-800">
          Cost per Sqft $<span>{values.totalPrice}</span> per sqft
        </div>
        <div className="text-lg mt-2 font-bold text-gray-800">
          Total Square Feet: <span>{values.totalSquareFeet}</span> sqft
        </div>
        <div className="text-xl mt-3 font-bold text-red-700 pt-2">
          Total Cost $<span>{values.totalCost}</span>
        </div>
      </div>
    </main>
  );
}
