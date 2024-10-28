import type { LoaderFunction, MetaFunction } from "@remix-run/node";
import { Outlet } from "@remix-run/react";
import { PageLayout } from "~/components/PageLayout";

import { Tabs, TabsList } from "~/components/ui/tabs";
import { NavTab } from "~/components/molecules/NavTab";
import { redirect } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [
    { title: "Granite Depot Database" },
    { name: "description", content: "Welcome to Remix!" },
  ];
};

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  console.log(url.pathname);

  if (["/admin", "/admin/"].includes(url.pathname)) {
    return redirect("stones");
  }
  return null;
};

export default function Admin() {
  return (
    <PageLayout title="Granite Depot DataBase">
      <Tabs defaultValue="stones">
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
