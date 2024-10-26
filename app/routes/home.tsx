import type { MetaFunction } from "@remix-run/node";
import { Outlet } from "@remix-run/react";
import { PageLayout } from "~/components/PageLayout";

import { Tabs, TabsList } from "~/components/ui/tabs";
import { NavTab } from "~/components/molecules/NavTab";

export const meta: MetaFunction = () => {
  return [
    { title: "Granite Depot Database" },
    { name: "description", content: "Welcome to Remix!" },
  ];
};

export default function Home() {
  return (
    <PageLayout title="Granite Depot DataBase">
      <Tabs defaultValue="account">
        <TabsList>
          <NavTab name="Stones" />
          <NavTab name="Sinks" />
          <NavTab name="Suppliers" />
          <NavTab name="Supports" />
          <NavTab name="Documents" />
          <NavTab name="Images" />
        </TabsList>
        <Outlet />
      </Tabs>
    </PageLayout>
  );
}
