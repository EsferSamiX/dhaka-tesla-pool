import Link from "next/link";
import { Logo } from "@/components/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-6 pt-6">
      <Link href="/" aria-label="Dhaka Tesla Pool home">
        <Logo className="size-20" />
      </Link>
      {children}
    </div>
  );
}
