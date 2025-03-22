export interface InstructionsBasic {
  title: string;
  id: number;
  parent_id: number | null;
}

export interface InstructionsReturn {
  key: number;
  value: string;
}

export function parentOptions(
  instructions: InstructionsBasic[],
): InstructionsReturn[] {
  let values = instructions.map((instruction) => ({
    key: instruction.id,
    value: instruction.title,
  }));
  values.unshift({ key: 0, value: "Main" });
  return values;
}

export function afterOptions(
  parent_id: number | undefined,
  instructions: InstructionsBasic[],
): InstructionsReturn[] {
  let values = instructions
    .filter((item) => item.parent_id === (parent_id || null))
    .map((instruction) => ({
      key: instruction.id,
      value: instruction.title,
    }));
  values.unshift({ key: 0, value: "First" });
  return values;
}
