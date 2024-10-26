import { useState } from "react";
import { PageLayout } from "~/components/PageLayout";
import { Title } from "~/components/Title";
import ModuleList from "~/components/ModuleList";
import BlockList from "~/components/BlockList";

export default function AdminPage() {
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [stonesOpen, setStonesOpen] = useState(false);

  return (
    <PageLayout title="Admin Panel">
      {/* Your admin panel content */}
      <Title
        text="Instructions"
        state={instructionsOpen}
        setState={setInstructionsOpen}
      >
        <BlockList>
          <ModuleList name="Edit Instructions">
            <div className="mt-2">
              <a
                href="/admin/instructions/edit"
                className="text-blue-500 hover:underline"
              >
                Edit Instructions
              </a>
            </div>
          </ModuleList>
        </BlockList>
      </Title>

      <Title text="Stones" state={stonesOpen} setState={setStonesOpen}>
        <BlockList>
          <ModuleList name="Manage Stones">
            <div className="mt-2 space-y-4">
              <a
                href="/admin/stones/new"
                className="text-blue-500 hover:underline"
              >
                Add New Stone
              </a>
            </div>
          </ModuleList>
        </BlockList>
      </Title>
    </PageLayout>
  );
}
