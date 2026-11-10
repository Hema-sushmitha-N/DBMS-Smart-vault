import "./globals.css";
export const metadata = {
  title: "SmartVault · Inventory intelligence",
  description:
    "Multi-warehouse inventory, procurement, and pattern intelligence.",
};
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
