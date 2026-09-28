import { RequireRole } from "@/components/require-role";

export default function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RequireRole role="DRIVER">{children}</RequireRole>;
}
