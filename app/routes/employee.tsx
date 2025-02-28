import type { LoaderFunction, MetaFunction } from "react-router";
import { useLocation, useNavigate, Outlet } from "react-router";
import { PageLayout } from "~/components/PageLayout";
// import { TransitionGroup, CSSTransition } from "react-transition-group";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { redirect } from "react-router";
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

  const getTabClassName = (tab: string) =>
    `relative px-4 py-2 text-sm font-medium rounded-md transition-all duration-300 ${
      currentTab === tab
        ? "text-blue-600  decoration-2"
        : "text-gray-600 hover:text-blue-500 "
    }`;

  return isDataBase ? (
    <PageLayout title="Granite Depot DataBase">
      <Tabs
        value={currentTab}
        onValueChange={handleTabChange}
        orientation="vertical"
      >
        <TabsList className="flex flex-col pt-20 sm:pt-0 pb-5 sm:flex-row sm:justify-start">
          <TabsTrigger value="stones" className={getTabClassName("stones")}>
            Stones
          </TabsTrigger>
          <TabsTrigger value="sinks" className={getTabClassName("sinks")}>
            Sinks
          </TabsTrigger>
          <TabsTrigger
            value="suppliers"
            className={getTabClassName("suppliers")}
          >
            Suppliers
          </TabsTrigger>
          <TabsTrigger value="supports" className={getTabClassName("supports")}>
            Supports
          </TabsTrigger>
          <TabsTrigger
            value="documents"
            className={getTabClassName("documents")}
          >
            Documents
          </TabsTrigger>
          <TabsTrigger value="images" className={getTabClassName("images")}>
            Images
          </TabsTrigger>
        </TabsList>
        {/* <TransitionGroup component={null}>
          <CSSTransition
            key={location.key}
            timeout={300}
            classNames={{
              enter: "opacity-0 scale-95",
              enterActive:
                "opacity-100 scale-100 transition-all duration-300 ease-out",
              exit: "opacity-100 scale-100",
              exitActive:
                "opacity-0 scale-95 transition-all duration-300 ease-out",
            }}
            unmountOnExit
          >
            <div>
              <Outlet />
            </div>
          </CSSTransition>
        </TransitionGroup> */}
        <Outlet />
      </Tabs>
    </PageLayout>
  ) : (
    <Outlet />
  );
}
