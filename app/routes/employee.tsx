import type { LoaderFunction, MetaFunction } from "@remix-run/node";
import { useLocation, useNavigate, Outlet } from "@remix-run/react";
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
  if (["/employee", "/employee/"].includes(url.pathname)) {
    return redirect("/employee/stones");
  }
  return null;
};

export default function Employee() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentTab = location.pathname.split("/")[2] || "stones";

  const handleTabChange = (value: string) => {
    navigate(`/employee/${value}`);
  };

  return (
    <PageLayout title="Granite Depot DataBase">
      <Tabs value={currentTab} onValueChange={handleTabChange}>
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
