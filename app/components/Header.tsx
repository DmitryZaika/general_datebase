// src/components/Header.tsx

import HeaderCustomers from "./organisms/HeaderCustomers";
import { HeaderDesktop } from "./organisms/HeaderDesktop";
import { HeaderMobile } from "./organisms/HeaderMobile";
import { HeaderProps } from "~/types";

export function Header({
  user,
  isEmployee,
  isAdmin,
  isSuperUser,
}: HeaderProps) {
  console.log(isEmployee, isAdmin, isSuperUser);
  if (!isEmployee && !isAdmin && !isSuperUser) {
    return <HeaderCustomers />;
  }
  return (
    <>
      {" "}
      <HeaderDesktop
        className="hidden md:flex"
        user={user}
        isAdmin={isAdmin}
        isSuperUser={isSuperUser}
      />
      <HeaderMobile
        className="block md:hidden"
        user={user}
        isAdmin={isAdmin}
        isSuperUser={isSuperUser}
      />
    </>
  );
}
