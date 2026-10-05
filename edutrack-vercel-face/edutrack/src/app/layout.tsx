import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "EduTrack — GPS Student Attendance",
  description:
    "GPS-based student attendance system with geofencing, role-based portals and live dashboards.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
