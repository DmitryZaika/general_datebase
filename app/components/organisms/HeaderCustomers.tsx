export default function HeaderCustomers({}) {
  return (
    <header className="flex justify-center p-4">
      <a href="stones">
        <img
          src="https://granite-database.s3.us-east-2.amazonaws.com/static-images/logo_gd_main.webp"
          alt="Logo"
          className="h-12 md:h-16 object-contain"
        />
      </a>
    </header>
  );
}
