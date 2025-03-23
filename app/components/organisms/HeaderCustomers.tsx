//// filepath: c:\Users\sarah\general_datebase\app\components\organisms\HeaderCustomers.tsx
import { useLocation } from "react-router";

export default function HeaderCustomers() {
  const location = useLocation();
  const isLogin = location.pathname.includes("login");

  return (
    <>
      <header className="flex justify-center p-4">
        <a href={isLogin ? "/" : "stones"}>
          <img
            src="https://granite-database.s3.us-east-2.amazonaws.com/static-images/logo_gd_main.webp"
            alt="Logo"
            className="h-12 md:h-16 object-contain"
          />
        </a>
      </header>
      <body></body>
    </>
  );
}
