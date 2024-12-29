import { LoaderFunctionArgs, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Accordion,
  AccordionItem,
  AccordionContent,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { db } from "~/db.server";
import { selectMany } from "~/utils/queryHelpers";
import { getEmployeeUser } from "~/utils/session.server";
import { PageLayout } from "~/components/PageLayout";
import { Instruction } from "~/types";
import "~/styles/instructions.css";

interface InstructionNode {
  id: number;
  title: string | null;
  text: string;
  after_id: number | null;
  children: InstructionNode[];
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

const InstructionItem: React.FC<InstructionItemProps> = ({ instruction }) => {
  const hasTitle = Boolean(instruction.title);

  if (hasTitle) {
    return (
      <AccordionItem value={instruction.id.toString()}>
        <AccordionTrigger className="py-4 underline underline-offset-4">
          {instruction.title}
        </AccordionTrigger>
        <AccordionContent>
          <div
            className="prose max-w-none w-full instructions"
            dangerouslySetInnerHTML={{ __html: instruction.text }}
          />
          {instruction.children.length > 0 && (
            <Accordion type="multiple" className="ml-5">
              {instruction.children.map((childInstruction) => (
                <InstructionItem
                  key={childInstruction.id}
                  instruction={childInstruction}
                />
              ))}
            </Accordion>
          )}
        </AccordionContent>
      </AccordionItem>
    );
  } else {
    return (
      <div className="py-4">
        <div
          className="prose overflow-auto break-words w-full"
          dangerouslySetInnerHTML={{ __html: instruction.text }}
        />
        {instruction.children.length > 0 && (
          <div className="ml-5">
            {instruction.children.map((childInstruction) => (
              <InstructionItem
                key={childInstruction.id}
                instruction={childInstruction}
              />
            ))}
          </div>
        )}
      </div>
    );
  }
};

function cleanData(instructions: Instruction[]): InstructionNode[] {
  const nodeMap: Map<number, InstructionNode> = new Map();
  instructions.forEach((item) => {
    nodeMap.set(item.id, {
      id: item.id,
      title: item.title,
      text: item.rich_text,
      after_id: item.after_id,
      children: [],
    });
  });
  const rootNodes: InstructionNode[] = [];

  const insertNodeInOrder = (
    nodes: InstructionNode[],
    node: InstructionNode
  ) => {
    if (node.after_id === null) {
      nodes.unshift(node);
    } else {
      const index = nodes.findIndex((n) => n.id === node.after_id);
      if (index !== -1) {
        nodes.splice(index + 1, 0, node);
      } else {
        nodes.push(node);
      }
    }
  };

  instructions.forEach((item) => {
    const node = nodeMap.get(item.id)!;
    if (item.parent_id === null) {
      insertNodeInOrder(rootNodes, node);
    } else {
      const parentNode = nodeMap.get(item.parent_id);
      if (parentNode) {
        insertNodeInOrder(parentNode.children, node);
      } else {
        console.warn(
          `Parent with id ${item.parent_id} not found for item id ${item.id}`
        );
      }
    }
  });

  return rootNodes;
}

export default function Instructions() {
  const { instructions } = useLoaderData<typeof loader>();
  const finalInstructions = cleanData(instructions);

  return (
    <PageLayout title="Instructions">
      <Accordion type="multiple">
        {finalInstructions.map((instruction) => (
          <InstructionItem key={instruction.id} instruction={instruction} />
        ))}
      </Accordion>
    </PageLayout>
  );
}
