import { Link, useLocation, useNavigation } from "react-router";
import { TodoList } from "../organisms/TodoList";
import { HeaderProps } from "~/types";

interface HeaderMobileProps extends HeaderProps {
  className: string;
}
interface BurgerLinkProps {
  setOpen: (value: boolean) => void;
  to: string;
  children: JSX.Element | string;
  className?: string;
  onClick?: () => void;
}
import React, { useState, useEffect, type JSX } from "react";
import { Button } from "~/components/ui/button";
import { Menu, X } from "lucide-react";
import { LoadingButton } from "../molecules/LoadingButton";
import clsx from "clsx";

function BurgerLink({ setOpen, to, children, className, onClick }: BurgerLinkProps) {
  const handleClick = () => {
    setOpen(false);
    if (onClick) onClick();
  };

  return (
    <Link
      className={clsx("uppercase text-lg font-bold", className)}
      to={to}
      onClick={handleClick}
    >
      {children}
    </Link>
  );
}

// Функция для определения противоположного URL
function getMirroredUrl(path: string) {
  const segments = path.split('/').filter(Boolean);
  
  if (segments.length < 1) return "/employee";
  
  const currentRole = segments[0]; // "admin" или "employee"
  const targetRole = currentRole === "admin" ? "employee" : "admin";
  
  // Если нет второго сегмента, просто возвращаем базовый URL
  if (segments.length < 2) return `/${targetRole}`;
  
  // Получаем текущий раздел (stones, instructions и т.д.)
  const currentSection = segments[1];
  
  // Набор разделов, для которых нужно обеспечить прямое соответствие
  const supportedSections = ["stones", "instructions", "sinks", "suppliers", "supports", "documents", "images"];
  
  // Если текущий раздел поддерживается, создаем зеркальный URL
  if (supportedSections.includes(currentSection)) {
    return `/${targetRole}/${currentSection}`;
  }
  
  // Для всех других разделов просто переходим на базовый URL
  return `/${targetRole}`;
}

export function BurgerMenu({
  user,
  isAdmin,
  isSuperUser,
}: Omit<HeaderMobileProps, "className">) {
  const location = useLocation();
  const navigation = useNavigation();
  const isAdminPage = location.pathname.startsWith("/admin");
  const isCustomerPage = location.pathname.startsWith("/customer");
  const [open, setOpen] = useState(false);
  const [isRoleSwitching, setIsRoleSwitching] = useState(false);
  const [isCustomerSwitching, setIsCustomerSwitching] = useState(false);
  
  // Сброс состояния загрузки при завершении навигации
  useEffect(() => {
    if (navigation.state === "idle") {
      if (isRoleSwitching) setIsRoleSwitching(false);
      if (isCustomerSwitching) setIsCustomerSwitching(false);
    }
  }, [navigation.state]);
  
  // Получаем целевой URL для переключения между admin и employee
  const targetPath = getMirroredUrl(location.pathname);
  
  // Получаем URL для кнопки Customer
  const getCustomerUrl = () => {
    return isCustomerPage ? `/employee/stones` : `/customer/1/stones`;
  };
  
  // Обработчики для имитации загрузки
  const handleRoleSwitchClick = () => {
    setIsRoleSwitching(true);
  };
  
  const handleCustomerSwitchClick = () => {
    setIsCustomerSwitching(true);
  };

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
            <X className="" style={{ width: "25px", height: "25px" }} />
          </Button>

          <nav className="flex flex-col space-y-2 pt-1">
            <a href="/" className="uppercase text-lg font-bold"></a>
            <div className="flex gap-1">
              {isAdmin || isSuperUser ? (
                isAdminPage ? (
                  <BurgerLink
                    to={targetPath}
                    className="pb-10"
                    setOpen={setOpen}
                    onClick={handleRoleSwitchClick}
                  >
                    <LoadingButton loading={isRoleSwitching}>Employee</LoadingButton>
                  </BurgerLink>
                ) : (
                  <BurgerLink 
                    to={targetPath} 
                    className="pb-2" 
                    setOpen={setOpen}
                    onClick={handleRoleSwitchClick}
                  >
                    <LoadingButton loading={isRoleSwitching}>Admin</LoadingButton>
                  </BurgerLink>
                )
              ) : null}
              <BurgerLink
                to={getCustomerUrl()}
                setOpen={setOpen}
                onClick={handleCustomerSwitchClick}
              >
                <LoadingButton loading={isCustomerSwitching}>
                  {isCustomerPage ? "Employee" : "Customer"}
                </LoadingButton>
              </BurgerLink>
              {isSuperUser ? (
                isAdminPage ? (
                  <BurgerLink to="/admin/users" setOpen={setOpen}>
                    <Button>Users</Button>
                  </BurgerLink>
                ) : null
              ) : null}
            </div>

            {user !== null && (
              <BurgerLink to="/logout" className="pt-2" setOpen={setOpen}>
                <Button>Logout</Button>
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
