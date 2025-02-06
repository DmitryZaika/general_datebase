import type { LoaderFunction, MetaFunction } from "@remix-run/node";
import { useLocation, useNavigate, Outlet } from "@remix-run/react";
import { PageLayout } from "~/components/PageLayout";

import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { redirect } from "@remix-run/node";
import { getAdminUser } from "~/utils/session.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Granite Depot Database" },
    { name: "description", content: "Welcome to Remix!" },
  ];
};

export const loader: LoaderFunction = async ({ request }) => {
  try {
    await getAdminUser(request);
  } catch (error) {
    return redirect(`/login?error=${error}`);
  }
  const url = new URL(request.url);
  if (["/admin", "/admin/"].includes(url.pathname)) {
    return redirect("/admin/stones");
  }
  return null;
};

export default function Admin() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentTab = location.pathname.split("/")[2] || "stones";

  const handleTabChange = (value: string) => {
    navigate(`/admin/${value}`);
  };

  const isDataBase =
    location.pathname.startsWith("/admin/stones") ||
    location.pathname.startsWith("/admin/sinks") ||
    location.pathname.startsWith("/admin/images") ||
    location.pathname.startsWith("/admin/supports") ||
    location.pathname.startsWith("/admin/documents") ||
    location.pathname.startsWith("/admin/suppliers");

  return isDataBase ? (
    <PageLayout title="Granite Depot DataBase">
      <Tabs value={currentTab} onValueChange={handleTabChange}>
        <TabsList className="cursor-pointer">
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
