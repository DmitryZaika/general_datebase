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
  children?: InstructionTree;
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

export default function Instructions() {
  const { instructions } = useLoaderData<typeof loader>();
  function cleanData(instructions: Instruction[]): InstructionTree {
    // Create a map to hold all instruction nodes by their id
    const nodeMap: Map<number, InstructionNode> = new Map();

    // Initialize each instruction node and store it in the map
    instructions.forEach((item) => {
      nodeMap.set(item.id, {
        title: item.title,
        text: item.rich_text,
        children: {},
      });
    });

    // Initialize the root nodes (instructions with no parent)
    const rootNodes: InstructionTree = {};

    // Link each instruction node to its parent
    instructions.forEach((item) => {
      const node = nodeMap.get(item.id)!;
      if (item.parent_id === null) {
        // This is a root node
        rootNodes[item.id] = node;
      } else {
        // Find the parent node
        const parentNode = nodeMap.get(item.parent_id);
        if (parentNode) {
          // Attach the current node to its parent's children
          parentNode.children[item.id] = node;
        } else {
          // Handle the case where the parent is not found
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
    <Accordion type="single" defaultValue="Instructions">
      <AccordionItem value="Instructions">
        <AccordionContent>
          <Accordion type="multiple">
            <AccordionContent>
              {instructions.map((instruction) => (
                <ModuleList key={instruction.id}></ModuleList>
              ))}
            </AccordionContent>
          </Accordion>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
