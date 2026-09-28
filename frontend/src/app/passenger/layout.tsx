import { RequireRole } from "@/components/require-role";

export default function PassengerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RequireRole role="PASSENGER">{children}</RequireRole>;
}
