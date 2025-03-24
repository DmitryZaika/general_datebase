import { Link, useLocation, useNavigate, useNavigation } from "react-router";
import { Button } from "~/components/ui/button";
import { TodoList } from "../organisms/TodoList";
import clsx from "clsx";
import { HeaderProps } from "~/types";
import { LoadingButton } from "../molecules/LoadingButton";
import { useEffect, useState } from "react";

interface HeaderDesktopProps extends HeaderProps {
  className: string;
}

export function HeaderDesktop({
  user,
  isAdmin,
  isSuperUser,
  className,
  isEmployee,
}: HeaderDesktopProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const isAdminPage = location.pathname.startsWith("/admin");
  const isCustomerPage = location.pathname.startsWith("/customer");
  const [isRoleSwitching, setIsRoleSwitching] = useState(false);
  const [isCustomerSwitching, setIsCustomerSwitching] = useState(false);
  
  // Сброс состояния загрузки при завершении навигации
  useEffect(() => {
    if (navigation.state === "idle") {
      if (isRoleSwitching) setIsRoleSwitching(false);
      if (isCustomerSwitching) setIsCustomerSwitching(false);
    }
  }, [navigation.state]);

  // Создаем функцию для определения противоположного URL
  const getMirroredUrl = () => {
    const path = location.pathname;
    const segments = path.split('/').filter(Boolean);
    
    if (segments.length < 1) return isAdminPage ? "/employee" : "/admin";
    
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
  };
  
  // Обработчик клика для имитации загрузки
  const handleRoleSwitchClick = () => {
    setIsRoleSwitching(true);
  };

  // Обработчик клика для имитации загрузки при переключении на Customer
  const handleCustomerSwitchClick = () => {
    setIsCustomerSwitching(true);
  };

  // Получаем URL для кнопки Customer
  const getCustomerUrl = () => {
    return isCustomerPage ? `/employee/stones` : `/customer/1/stones`;
  };

  return (
    <header
      className={clsx(
        "relative flex-row items-center   gap-0 justify-between  p-3 ",
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
              <Link to={getMirroredUrl()} onClick={handleRoleSwitchClick}>
                <LoadingButton loading={isRoleSwitching}>Employee</LoadingButton>
              </Link>
            </div>
          ) : (
            <Link to={getMirroredUrl()} onClick={handleRoleSwitchClick}>
              <LoadingButton loading={isRoleSwitching}>Admin</LoadingButton>
            </Link>
          )
        ) : null}
        <Link to={getCustomerUrl()} onClick={handleCustomerSwitchClick}>
          <LoadingButton loading={isCustomerSwitching}>
            {isCustomerPage ? "Employee" : "Customer"}
          </LoadingButton>
        </Link>
      </div>
      <nav className="text-center flex-1">
        <ul className="flex-col md:flex-row flex flex-wrap justify-center ali md:justify-center gap-4">
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
