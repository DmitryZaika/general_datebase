// src/components/Header.tsx

import { HeaderDesktop } from "./organisms/HeaderDesktop";
import { HeaderMobile } from "./organisms/HeaderMobile";
import { HeaderProps } from "~/types";

export function Header({ user, isAdmin, isSuperUser }: HeaderProps) {
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
