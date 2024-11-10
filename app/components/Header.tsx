import { useState } from "react";
import { Link, useNavigate, useLocation } from "@remix-run/react";
import { Button } from "~/components/ui/button";

export function Header() {
  const [loginError, setLoginError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await fetch("/logout", { method: "POST" });
    navigate("/");
  };
  const handleLoginSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;

    const formData = new FormData(form);
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;

    if (!username || !password) {
      setLoginError("Please enter both username and password.");
      return;
    }

    const response = await fetch("/login", {
      method: "POST",
      body: formData,
    });

    if (response.ok) {
      setLoginError("");
      navigate("/admin");
    } else {
      const errorText = await response.text();
      setLoginError(errorText || "Invalid credentials");
    }
  };

  const isAdminPage = location.pathname.startsWith("/admin");

  return (
    <header className="flex content-center flex-col align-middle gap-5 m-3 md:flex-row">
      <div className="logo">
        <a className="flex justify-center" href="/">
          <img
            src="https://granite-database.s3.us-east-2.amazonaws.com/static-images/logo_gd_main.webp"
            alt="Logo"
          />
        </a>
      </div>
      <nav className="w-full">
        <ul className="flex gap-5 h-full flex-col md:flex-row md:justify-center md:items-center">
          <li>
            <Button asChild variant="link">
              <Link
                to={isAdminPage ? "/admin/stones" : "/"}
                className="text-xl"
              >
                Database
              </Link>
            </Button>
          </li>
          <li>
            <Button asChild variant="link">
              <Link to="/instructions" className="text-xl">
                Instructions
              </Link>
            </Button>
          </li>
          <li>
            <Button asChild variant="link">
              {isAdminPage || (
                <Link to="/special-order" className="text-xl">
                  Special Order
                </Link>
              )}
            </Button>
          </li>
          <li>
            <Button asChild variant="link">
              <Link
                to={isAdminPage ? "/admin/customers" : "/customers"}
                className="text-xl"
              >
                Customer
              </Link>
            </Button>
          </li>
        </ul>
      </nav>
      <div className="flex justify-center md:justify-end w-full md:w-auto"></div>
    </header>
  );
}
