export const DONE_KEY = "[DONE]035d8eba-9f8c-44c5-a1e0-290d1da033f7[/DONE]";

export const STONE_TYPES = [
  "granite",
  "quartz",
  "marble",
  "dolomite",
  "quartzite",
] as const;

export const SINK_TYPES = [
  "stainless 18 gauge",
  "stainless 16 gauge",
  "composite",
  "ceramic",
  "farm house",
] as const;

export const FAUCET_TYPES = ["single handle", "double handle"] as const;

export const BASE_PRICES = {
  mitered_edge_price: 200,
  corbels_price: 100,
  edge_price: {
    flat: 0,
    eased: 100,
    "1/4_bevel": 200,
    "1/2_bevel": 200,
    ogee: (linearFeet: number) => linearFeet * 25,
    bull_nose: (linearFeet: number) => linearFeet * 18,
  },
  seam_price: {
    phantom_seam: 250,
  },
  waterfall_price: 400,
  "stone_t/o": (sqft: number) => sqft * 10,
  "laminate_t/o": (sqft: number) => {
    if (sqft < 40) return 200;
    if (sqft >= 40 && sqft < 55) return 250;
    if (sqft >= 55 && sqft < 70) return 300;
    return 350;
  },
  "vanity_t/o": 100,
  stove_price: {
    "f/s": 0,
    "s/i": 0,
    "c/t": 200,
    grill: 200,
    "n/a": 0,
  },
};

export const CUSTOMER_ITEMS = {
  tripFee: {
    miles: "number",
    priceFn: ({ miles }: { miles: number }) => miles * 4,
  },
  oversize_piece: {
    sqft: {
      "20+ sqft": 200,
      "40+ sqft": 400,
      "50+ sqft": 500,
    },
    priceFn: ({ sqft }: { sqft: number }) => sqft,
  },
  mitter_edge_price: {
    amount: "number",
    priceFn: ({ amount }: { amount: number }) => amount * 200,
  },
};
