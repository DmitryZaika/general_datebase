import { Buffer } from "buffer";

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

// const BASE_PRICES = {
//   corbels: 100,
//   edge: {
//     flat: 0,
//     east: 100,
//     ogee: (linearFeet: number) => linearFeet * 100,
//   },
// };
