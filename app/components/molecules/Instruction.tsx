interface InstructionProps {
  id: number;
  title: string;
  parent_id: number | null;
  after_id: number | null;
  rich_text: string;
}

export function Instruction({
  title,
  rich_text,
  after_id,
  parent_id,
}: InstructionProps) {
  return (
    <div className="flex flex-col items-center">
      <ul>
        <li {parent_id}>{title}</li>
        <li {after_id}>{rich_text}</li>
      </ul>
    </div>
  );
}
