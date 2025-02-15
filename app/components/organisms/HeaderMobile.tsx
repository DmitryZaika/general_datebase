import { Link, useLocation } from "@remix-run/react";
import { TodoList } from "../organisms/TodoList";
import { HeaderProps } from "~/types";

interface HeaderMobileProps extends HeaderProps {
  className: string;
}
import React, { useState } from "react";
import { Button } from "~/components/ui/button";
import { Menu, X } from "lucide-react";
import clsx from "clsx";

export function BurgerMenu({
  user,
  isAdmin,
  isSuperUser,
}: Omit<HeaderMobileProps, "className">) {
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith("/admin");
  const [open, setOpen] = useState(false);
  // console.log(isAdminPage);
  console.log(isSuperUser);
  return (
    <>
      <Button
        variant="ghost"
        onClick={() => setOpen(true)}
        className="p-6"
        aria-label="Open menu"
      >
        <Menu size={24} />
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
          }
        )}
      >
        <div className="p-4">
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            className="absolute top-1 right-1"
            aria-label="Закрыть меню"
          >
            <X className="" size={24} />
          </Button>

          <nav className="flex flex-col space-y-2 pt-1">
            <a href="/" className="uppercase text-lg font-bold"></a>
            <div className="flex gap-1">
              {" "}
              {isAdmin || isSuperUser ? (
                isAdminPage ? (
                  <Link
                    className="uppercase text-lg font-bold mb-10"
                    to="/employee"
                  >
                    <Button>Employee</Button>
                  </Link>
                ) : (
                  <Link
                    className="uppercase text-lg font-bold mb-10"
                    to="/admin"
                  >
                    <Button>Admin</Button>
                  </Link>
                )
              ) : null}
              {isSuperUser ? (
                isAdminPage ? (
                  <Link
                    className="uppercase text-lg font-bold"
                    to="/admin/users"
                  >
                    <Button>User Panel</Button>
                  </Link>
                ) : null
              ) : null}
            </div>

            <Link
              to={isAdminPage ? "/admin/stones" : "/employee/stones"}
              className="uppercase text-lg font-bold"
            >
              Database
            </Link>

            <Link
              to={
                isAdminPage ? "/admin/instructions" : "/employee/instructions"
              }
              className="uppercase text-lg font-bold"
            >
              Instructions
            </Link>
            {!isAdminPage && (
              <Link
                to="/employee/special-order"
                className="uppercase text-lg font-bold"
              >
                Special Order
              </Link>
            )}
            {user !== null && (
              <Link className="uppercase text-lg font-bold mt-10" to="/logout">
                <Button> Logout</Button>
              </Link>
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
