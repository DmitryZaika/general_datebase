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


export const AES_KEY = Buffer.from(process.env.AES_KEY, 'hex');
if (AES_KEY.length !== 32) throw new Error('QBO_AES_KEY должен быть 256‑битным');
