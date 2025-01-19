// src/components/Header.tsx
import { Link, useLocation } from "@remix-run/react";
import { Button } from "~/components/ui/button";
// import { TodoList } from "./TodoList";
// import { Todo } from "~/types";

interface HeaderProps {
  user: object | null;
  isAdmin: boolean;
  isSuperUser: boolean;
  isEmployee: boolean;
  // todos: Todo[];
}

export function Header({
  user,
  isAdmin,
  isSuperUser,
  isEmployee,
}: HeaderProps) {
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith("/admin");

  return (
    <header className="flex flex-col relative md:flex-row items-center gap-5  md:gap-0 justify-between p-4 m-3 ">
      <div className="logo">
        <a className="flex justify-center" href="/">
          <img
            src="https://granite-database.s3.us-east-2.amazonaws.com/static-images/logo_gd_main.webp"
            alt="Logo"
            className="h-12 md:h-16 object-contain"
          />
        </a>
      </div>

      <div className="flex gap-4">
        {isAdmin || isSuperUser ? (
          isAdminPage ? (
            <Link to="/employee">
              <Button>Employee</Button>
            </Link>
          ) : (
            <Link to="/admin">
              <Button>Admin</Button>
            </Link>
          )
        ) : null}
        {isSuperUser ? (
          isAdminPage ? (
            <Link to="/admin/users">
              <Button>Add User</Button>
            </Link>
          ) : null
        ) : null}
      </div>
      <nav className="text-center flex-1">
        <ul className="flex-col md:flex-row flex flex-wrap justify-center ali md:justify-center gap-4">
          <li>
            <Button asChild variant="link">
              <Link
                to={isAdminPage ? "/admin/stones" : "/employee/stones"}
                className="text-xl md:text-xl"
              >
                Database
              </Link>
            </Button>
          </li>
          <li>
            <Button asChild variant="link">
              <Link
                to={
                  isAdminPage ? "/admin/instructions" : "/employee/instructions"
                }
                className="text-xl md:text-xl"
              >
                Instructions
              </Link>
            </Button>
          </li>
          {!isAdminPage && (
            <li>
              <Button asChild variant="link">
                <Link
                  to="/employee/special-order"
                  className="text-xl md:text-xl"
                >
                  Special Order
                </Link>
              </Button>
            </li>
          )}
          {/* {isAdminPage && (
            <li>
              <Button asChild variant="link">
                <Link
                  to="/admin/ai-instructions"
                  className="text-lg md:text-xl"
                >
                  AI Instructions
                </Link>
              </Button>
            </li>
          )} */}
          {/* {!isAdminPage && (
            <li>
              <Button asChild variant="link">
                <Link to="/employee/customers" className="text-lg md:text-xl">
                  Customer
                </Link>
              </Button>
            </li>
          )} */}
        </ul>
      </nav>
      {/* <TodoList todos={todos} /> */}

      {user !== null && (
        <Link to="/logout">
          <Button>Logout</Button>
        </Link>
      )}
      <div className="flex justify-center md:justify-end w-full md:w-auto"></div>
    </header>
  );
}
