import { Link, useLocation } from "react-router";
import { Button } from "~/components/ui/button";
import { TodoList } from "../organisms/TodoList";
import clsx from "clsx";
import { HeaderProps } from "~/types";

interface HeaderDesktopProps extends HeaderProps {
  className: string;
}

export function HeaderDesktop({
  user,
  isAdmin,
  isSuperUser,
  className,
}: HeaderDesktopProps) {
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith("/admin");
  return (
    <header
      className={clsx(
        "relative flex-row items-center   gap-0 justify-between  m-3 ",
        className
      )}
    >
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
            <div className=" flex gap-4">
              <Link to="/employee">
                <Button>Employee</Button>
              </Link>
            </div>
          ) : (
            <Link to="/admin">
              <Button>Admin</Button>
            </Link>
          )
        ) : null}
        {isSuperUser ? (
          isAdminPage ? (
            <Link to="/admin/users">
              <Button>User Panel</Button>
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

      <TodoList />

      {user !== null && (
        <Link to="/logout">
          <Button>Logout</Button>
        </Link>
      )}
      <div className="flex justify-center md:justify-end w-full md:w-auto"></div>
    </header>
  );
}
