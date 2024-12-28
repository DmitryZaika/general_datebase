// src/components/Header.tsx
import { Link, useLocation } from "@remix-run/react";
import { Button } from "~/components/ui/button";
// import { TodoList } from "./TodoList";
// import { Todo } from "~/types";

interface HeaderProps {
  activeSession: string | null;
  isAdmin: boolean;
  isSuperUser: boolean;
  isEmployee: boolean;
  // todos: Todo[];
}

export function Header({
  activeSession,
  isAdmin,
  isSuperUser,
  isEmployee,
}: HeaderProps) {
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith("/admin");

  const handleSearch = (query: string) => {
    // Логика обработки поиска, например, логирование или аналитика
    console.log("Header получил запрос поиска:", query);
    // Переадресация осуществляется в SearchBar через navigate
  };

  return (
    <header className="flex flex-col relative md:flex-row items-center justify-between p-4 gap-4 m-3 md:gap-5">
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
      </div>
      <nav className="flex-1">
        <ul className="flex flex-wrap justify-center md:justify-center gap-4">
          <li>
            <Button asChild variant="link">
              <Link
                to={isAdminPage ? "/admin/stones" : "/employee/stones"}
                className="text-lg md:text-xl"
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
                className="text-lg md:text-xl"
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
                  className="text-lg md:text-xl"
                >
                  Special Order
                </Link>
              </Button>
            </li>
          )}
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

      {activeSession && (
        <Link to="/logout">
          <Button>Logout</Button>
        </Link>
      )}
      <div className="flex justify-center md:justify-end w-full md:w-auto"></div>
    </header>
  );
}
