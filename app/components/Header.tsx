export function Header() {
  return (
    <header>
      <div className="logo">
        <a href="index.html">
          <img src="./images/logo_gd_main.webp" alt="Logo" />
        </a>
      </div>
      <nav className="main-nav">
        <ul className="main-nav_list">
          <li>
            <a href="./index.html">Database</a>
          </li>
          <li>
            <a href="./instructions.html">Instructions</a>
          </li>
          <li>
            <a href="./special-order.html">Special order</a>
          </li>
          <li>
            <a href="./customers.html">Customers</a>
          </li>
        </ul>
      </nav>
      <div className="search">
        <input id="searchInput" type="text" placeholder="Search..." />
        <ul id="searchResults" className="search-results hidden"></ul>
      </div>
    </header>
  );
}
