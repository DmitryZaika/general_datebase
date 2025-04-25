import { useLocation } from "react-router";

import {
  useNavigate,

  Outlet,
} from "react-router";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";



export default function SuppliersEdit() {
  const navigate = useNavigate();
  const location = useLocation();
 
  const handleChange = (open: boolean) => {
    if (!open) {
      navigate(`..${location.search}`);
    }
  };

  return (
    <Dialog open={true} onOpenChange={handleChange}>
      <DialogContent className="sm:max-w-[425px] overflow-auto flex flex-col justify-baseline min-h-[95vh] max-h-[95vh]">
        <DialogHeader>
          <DialogTitle>Edit Supplier</DialogTitle>
        </DialogHeader>
        <Tabs
          value={location.pathname.split("/").pop()}
          onValueChange={(value) => navigate(value)}
        >
        <TabsList>
            <TabsTrigger value={`information${location.search}`}>General</TabsTrigger>
            <TabsTrigger value={`files${location.search}`}>Files</TabsTrigger>
          </TabsList>
            <Outlet />
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
