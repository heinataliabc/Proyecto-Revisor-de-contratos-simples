import "./globals.css";

export const metadata = {
  title: "ContratoClaro",
  description: "Revisor académico de contratos simples en Colombia",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
