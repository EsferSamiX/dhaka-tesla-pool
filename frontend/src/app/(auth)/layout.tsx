export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 items-start justify-center pt-8">
      {children}
    </div>
  );
}
