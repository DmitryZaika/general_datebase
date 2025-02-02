export interface Todo {
  id: number;
  rich_text: string;
  is_done: boolean;
}

export interface InstructionSlim {
  id: number;
  title: string | null;
  rich_text: string;
}

export interface Instruction extends InstructionSlim {
  parent_id: number | null;
  after_id: number | null;
  children?: Instruction[];
}
