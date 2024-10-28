// Header.tsx

import { useState } from "react";
import { Link, useNavigate, useLocation } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";

export function Header() {
  const [loginError, setLoginError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Function to handle logout
  const handleLogout = async () => {
    await fetch("/logout", { method: "POST" });
    navigate("/");
  };

  // Function to handle form submission
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

    // Send credentials to the server for verification
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

  return (
    <header className="flex content-center flex-col align-middle gap-5 m-3 md:flex-row">
      <div className="logo">
        <a className="flex justify-center" href="/">
          <img src="./images/logo_gd_main.webp" alt="Logo" />
        </a>
      </div>
      <nav className="w-full">
        <ul className="flex gap-5 h-full flex-col md:flex-row md:justify-center md:items-center">
          <li>
            <Button asChild variant="link">
              <Link to="/" className="text-xl">
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
              <Link to="/special-order" className="text-xl">
                Special Order
              </Link>
            </Button>
          </li>
          <li>
            <Button asChild variant="link">
              <Link to="/customers" className="text-xl">
                Customer
              </Link>
            </Button>
          </li>
        </ul>
      </nav>
      <div className="flex justify-center md:justify-end w-full md:w-auto">
        {location.pathname === "/admin/stones" ? (
          <Button onClick={handleLogout}>Logout</Button>
        ) : (
          <Dialog>
            <DialogTrigger asChild>
              <Button>Admin</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Admin Login</DialogTitle>
                <DialogDescription>
                  Please enter your credentials to access the admin panel.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleLoginSubmit}>
                {loginError && (
                  <p className="text-red-500 mb-4 text-center">{loginError}</p>
                )}
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="username">Login</Label>
                    <Input id="username" name="username" type="text" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="remember" name="remember" />
                      <Label htmlFor="remember">Remember me</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="showPassword"
                        checked={showPassword}
                        onCheckedChange={() => setShowPassword(!showPassword)}
                      />
                      <Label htmlFor="showPassword">Show Password</Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit">Login</Button>
                    <Button
                      variant="link"
                      onClick={() =>
                        alert("Please contact support to reset your password.")
                      }
                    >
                      Forgot Password?
                    </Button>
                  </DialogFooter>
                </div>
              </form>
              <DialogClose asChild>
                <Button variant="ghost" className="absolute top-2 right-2">
                  ✕
                </Button>
              </DialogClose>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </header>
  );
}
