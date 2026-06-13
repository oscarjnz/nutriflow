export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return <div className="min-h-svh">{children}</div>;
}
