import { Link } from "@remix-run/react";

interface LinkProps {
  href: string;
  children: JSX.Element | string;
}

function LinkCard({ href, children }: LinkProps) {
  return (
    <li className="flex items-center justify-center text-yellow-400  bg-[#333] rounded-[]">
      <Link to={href}>{children}</Link>
    </li>
  );
}

export function Header() {
  return (
    <header className="flex content-center flex-col align-middle gap-5">
      <div className="logo ">
        <a className="flex justify-center" href="index.html">
          <img src="./images/logo_gd_main.webp" alt="Logo" />
        </a>
      </div>
      <nav className="main-nav">
        <ul className="flex gap-10 h-full flex-col">
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
