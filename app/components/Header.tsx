import { Link } from "@remix-run/react";

interface LinkProps {
  href: string;
  children: JSX.Element | string;
}

function LinkCard({ href, children }: LinkProps) {
  return (
    <li className="flex items-center justify-center ">
      <Link
        className="
      border-2 w-[90%] 
      text-center 
      md:px-[10px]
      py-[7px]
      border-solid
      border-[#ffd700]
      bg-[#333]
      text-[#ffd700]
      rounded-[10px]
      font-bold
      transition-colors
      duration-300
      ease-in-out
      md:w-[100%]
     hover:bg-[#ffd700]
    hover:text-gray-800
 "
        to={href}
      >
        {children}
      </Link>
    </li>
  );
}

export function Header() {
  return (
    <header className="flex content-center flex-col align-middle gap-5 m-3 md:flex-row">
      <div className="logo ">
        <a className="flex justify-center" href="/">
          <img src="./images/logo_gd_main.webp" alt="Logo" />
        </a>
      </div>
      <nav className="w-full">
        <ul className="flex gap-5 h-full flex-col md:flex-row md:justify-center md:items-center ">
          <LinkCard href="/">Database</LinkCard>
          <LinkCard href="/instructions">Instructions</LinkCard>
          <LinkCard href="/special-order">Special Order</LinkCard>
          <LinkCard href="/customers">Customer</LinkCard>
        </ul>
      </nav>
      {/* <div className="search">
        <input id="searchInput" type="text" placeholder="Search..." />
        <ul id="searchResults" className="search-results hidden"></ul>
      </div> */}
    </header>
  );
}
