// Header.tsx

import { useState } from "react";
import { Link, useNavigate, useLocation } from "@remix-run/react";

interface LinkProps {
  href: string;
  children: React.ReactNode;
}

function LinkCard({ href, children }: LinkProps) {
  return (
    <li className="flex items-center justify-center">
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Function to handle opening the modal
  const handleAdminClick = () => {
    setIsModalOpen(true);
    setLoginError("");
    // Set modalVisible to true after rendering
    setTimeout(() => {
      setModalVisible(true);
    }, 10);
  };

  // Function to handle closing the modal
  const handleCloseModal = () => {
    // Start the closing animation
    setModalVisible(false);
    // After the animation, remove the modal from DOM
    setTimeout(() => {
      setIsModalOpen(false);
      setLoginError("");
    }, 500); // Match this duration with the transition duration
  };

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
      setIsModalOpen(false);
      setLoginError("");
      navigate("/admin");
    } else {
      const errorText = await response.text();
      setLoginError(errorText || "Invalid credentials");
    }
  };

  return (
    <>
      <header className="flex content-center flex-col align-middle gap-5 m-3 md:flex-row">
        <div className="logo">
          <a className="flex justify-center" href="/">
            <img src="./images/logo_gd_main.webp" alt="Logo" />
          </a>
        </div>
        <nav className="w-full">
          <ul className="flex gap-5 h-full flex-col md:flex-row md:justify-center md:items-center">
            <LinkCard href="/">Database</LinkCard>
            <LinkCard href="/instructions">Instructions</LinkCard>
            <LinkCard href="/special-order">Special Order</LinkCard>
            <LinkCard href="/customers">Customer</LinkCard>
          </ul>
        </nav>
        <div className="flex justify-center md:justify-end w-full md:w-auto">
          {/* Change Admin to Logout if on Admin page */}
          {location.pathname === "/admin" ? (
            <button
              onClick={handleLogout}
              className="
                border-2 
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
                hover:bg-[#ffd700]
                hover:text-gray-800
              "
            >
              Logout
            </button>
          ) : (
            <button
              onClick={handleAdminClick}
              className="
                border-2 
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
                hover:bg-[#ffd700]
                hover:text-gray-800
              "
            >
              Admin
            </button>
          )}
        </div>
      </header>

      {/* Modal Window */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Darkened background */}
          <div
            className="fixed inset-0 bg-black opacity-50"
            onClick={handleCloseModal}
          ></div>

          {/* Modal content */}
          <div
            className={`
              bg-white rounded-lg p-6 z-10 w-11/12 max-w-md relative 
              transform transition-all duration-500 ease-out
              ${modalVisible ? "scale-100 opacity-100" : "scale-75 opacity-0"}
            `}
          >
            {/* Close button */}
            <button
              className="absolute top-2 right-2 text-gray-600 hover:text-gray-800 text-4xl"
              onClick={handleCloseModal}
            >
              &times;
            </button>
            <h2 className="text-2xl font-bold mb-4 text-center">Admin Login</h2>
            <form onSubmit={handleLoginSubmit}>
              {loginError && (
                <p className="text-red-500 mb-4 text-center">{loginError}</p>
              )}
              <label className="block mb-4">
                <span className="text-gray-700">Login</span>
                <input
                  type="text"
                  name="username"
                  className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                  required
                />
              </label>
              <label className="block mb-4">
                <span className="text-gray-700">Password</span>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                  required
                />
              </label>
              <div className="flex items-center justify-between mb-4">
                <label className="inline-flex items-center">
                  <input
                    type="checkbox"
                    name="remember"
                    className="form-checkbox w-6 h-6"
                  />
                  <span className="ml-2 text-gray-700">Remember me</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="checkbox"
                    className="form-checkbox w-6 h-6"
                    checked={showPassword}
                    onChange={() => setShowPassword(!showPassword)}
                  />
                  <span className="ml-2 text-gray-700">Show Password</span>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <button
                  type="submit"
                  className="
                    bg-[#333]
                    text-[#ffd700]
                    px-4 py-2
                    rounded-md
                    font-bold
                    transition-colors
                    duration-300
                    ease-in-out
                    hover:bg-[#ffd700]
                    hover:text-gray-800
                  "
                >
                  Login
                </button>
                <a
                  href="#"
                  className="text-blue-500 hover:underline"
                  onClick={() =>
                    alert("Please contact support to reset your password.")
                  }
                >
                  Forgot Password?
                </a>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
