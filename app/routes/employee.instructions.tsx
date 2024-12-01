import { json, LoaderFunctionArgs, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Accordion,
  AccordionItem,
  AccordionContent,
} from "~/components/ui/accordion";
import { db } from "~/db.server";

import { selectMany } from "~/utils/queryHelpers";
import ModuleList from "~/components/ModuleList";
import { getEmployeeUser } from "~/utils/session.server";

interface Instruction {
  id: number;
  title: string;
  parent_id: number | null;
  after_id: number | null;
  rich_text: string;
  children?: Instruction[];
}

type InstructionTree = Record<number, InstructionNode>;

interface InstructionNode {
  title: string;
  text: string;
  after_id: number | null;
  children?: InstructionTree;
}

interface InstructionItemProps {
  instruction: InstructionNode;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await getEmployeeUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  const instructions = await selectMany<Instruction>(
    db,
    "select id, title, parent_id, after_id, rich_text from instructions"
  );
  return { instructions };
};

const InstructionItem: React.FC<InstructionItemProps> = ({ instruction }) => (
  <li key={instruction.id} className="ml-5">
    {instruction.title}
    <p className="text-red-500">{instruction.text}</p>
    {instruction.children && (
      <ul>
        {Object.values(instruction.children).map((childInstruction) => (
          <InstructionItem
            key={childInstruction.id}
            instruction={childInstruction}
          />
        ))}
      </ul>
    )}
  </li>
);

export default function Instructions() {
  const { instructions } = useLoaderData<typeof loader>();
  function cleanData(instructions: Instruction[]): InstructionTree {
    const nodeMap: Map<number, InstructionNode> = new Map();

    instructions.forEach((item) => {
      nodeMap.set(item.id, {
        title: item.title,
        text: item.rich_text,
        after_id: item.after_id,
        children: {},
      });
    });

    const rootNodes: InstructionTree = {};

    instructions.forEach((item) => {
      const node = nodeMap.get(item.id)!;
      if (item.parent_id === null) {
        rootNodes[item.id] = node;
      } else {
        const parentNode = nodeMap.get(item.parent_id);
        if (parentNode) {
          parentNode.children[item.id] = node;
        } else {
          console.warn(
            `Parent with id ${item.parent_id} not found for item id ${item.id}`
          );
        }
      }
    });
    return rootNodes;
  }

  const finalInstructions = cleanData(instructions);
  console.log(finalInstructions);

  return (
    <>
      {Object.keys(finalInstructions).map((id) => (
        <ModuleList key={id}>
          <ul className="list-inside ml-5">
            <InstructionItem instruction={finalInstructions[id]} />
          </ul>
        </ModuleList>
      ))}
    </>
  );
}
