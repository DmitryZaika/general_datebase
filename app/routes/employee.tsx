import type { LoaderFunction, MetaFunction } from "@remix-run/node";
import { useLocation, useNavigate, Outlet } from "@remix-run/react";
import { PageLayout } from "~/components/PageLayout";

import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { redirect } from "@remix-run/node";
import { getEmployeeUser } from "~/utils/session.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Granite Depot Database" },
    { name: "description", content: "Welcome to Remix!" },
  ];
};

export const loader: LoaderFunction = async ({ request }) => {
  try {
    await getEmployeeUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
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

  const isDataBase =
    location.pathname.startsWith("/employee/stones") ||
    location.pathname.startsWith("/employee/sinks") ||
    location.pathname.startsWith("/employee/suppliers") ||
    location.pathname.startsWith("/employee/supports") ||
    location.pathname.startsWith("/employee/documents") ||
    location.pathname.startsWith("/employee/images");

  return isDataBase ? (
    <PageLayout title="Granite Depot DataBase">
      <Tabs value={currentTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="stones">Stones</TabsTrigger>
          <TabsTrigger value="sinks">Sinks</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="supports">Supports</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="images">Images</TabsTrigger>
        </TabsList>
        <Outlet />
      </Tabs>
    </PageLayout>
  ) : (
    <Outlet />
  );
}
