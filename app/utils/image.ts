export function getSourceName(source: string, name: string) {
  const cleanName = name.toLowerCase().replace(/\s+/g, "_").replace(/\$/g, "");
  return `./images/${source}/${cleanName}.webp`;
}
