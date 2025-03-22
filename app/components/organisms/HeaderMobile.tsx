import { Link, useLocation } from "react-router";
import { TodoList } from "../organisms/TodoList";
import { HeaderProps } from "~/types";

interface HeaderMobileProps extends HeaderProps {
  className: string;
}
interface BurgerLinkProps {
  setOpen: (value: boolean) => void;
  to: string;
  children: JSX.Element;
  className?: string;
}
import React, { useState, type JSX } from "react";
import { Button } from "~/components/ui/button";
import { Menu, X } from "lucide-react";
import clsx from "clsx";

function BurgerLink({ setOpen, to, children, className }: BurgerLinkProps) {
  return (
    <Link
      className={clsx("uppercase text-lg font-bold", className)}
      to={to}
      onClick={() => setOpen(false)}
    >
      {children}
    </Link>
  );
}

export function BurgerMenu({
  user,
  isAdmin,
  isSuperUser,
}: Omit<HeaderMobileProps, "className">) {
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith("/admin");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        onClick={() => setOpen(true)}
        className="p-6"
        aria-label="Open menu"
      >
        <Menu style={{ width: "25px", height: "25px" }} />
      </Button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 bg-black/50 z-40"
        />
      )}
      <div
        className={clsx(
          "fixed top-0 right-0 h-full w-64 bg-white shadow-lg z-50 transform transition-transform duration-300",
          {
            "translate-x-0": open,
            "translate-x-full": !open,
          },
        )}
      >
        <div className="p-4">
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            className="absolute top-1 right-1"
            aria-label="Закрыть меню"
          >
            <X className="" style={{ width: "25px", height: "25px" }} />
          </Button>

          <nav className="flex flex-col space-y-2 pt-1">
            <a href="/" className="uppercase text-lg font-bold"></a>
            <div className="flex gap-1">
              {" "}
              {isAdmin || isSuperUser ? (
                isAdminPage ? (
                  <BurgerLink
                    to="/employee"
                    className="pb-10"
                    setOpen={setOpen}
                  >
                    <Button>Employee</Button>
                  </BurgerLink>
                ) : (
                  <BurgerLink to="/admin" className="pb-10" setOpen={setOpen}>
                    <Button> Admin</Button>
                  </BurgerLink>
                )
              ) : null}
              {isSuperUser ? (
                isAdminPage ? (
                  <BurgerLink to="/admin/users" setOpen={setOpen}>
                    <Button>Users</Button>
                  </BurgerLink>
                ) : null
              ) : null}
            </div>

            <BurgerLink
              to={isAdminPage ? "/admin/stones" : "/employee/stones"}
              setOpen={setOpen}
            >
              Database
            </BurgerLink>

            <BurgerLink
              to={
                isAdminPage ? "/admin/instructions" : "/employee/instructions"
              }
              setOpen={setOpen}
            >
              Instruction
            </BurgerLink>

            {!isAdminPage && (
              <BurgerLink to="/employee/special-order" setOpen={setOpen}>
                Special Order
              </BurgerLink>
            )}
            {user !== null && (
              <BurgerLink to="/logout" className="pt-10" setOpen={setOpen}>
                <Button> Logout</Button>
              </BurgerLink>
            )}
          </nav>
        </div>
      </div>
    </>
  );
}

export function HeaderMobile({
  user,
  isAdmin,
  isSuperUser,
  className,
}: HeaderMobileProps) {
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith("/admin");
  return (
    <header className={clsx("flex justify-between", className)}>
      <div className="logo">
        <a className="flex justify-center" href="/">
          <img
            src="https://granite-database.s3.us-east-2.amazonaws.com/static-images/logo_gd_main.webp"
            alt="Logo"
            className="h-12 md:h-16 object-contain"
          />
        </a>
      </div>
      <TodoList />
      <BurgerMenu
        user={user}
        isAdmin={isAdmin}
        isSuperUser={isSuperUser}
      ></BurgerMenu>
    </header>
  );
}
