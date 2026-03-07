import { Header } from "@/components/layout/header";
import { RoleGuard } from "@/components/layout/role-guard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">

      <Header />

      <main className="flex-1 p-6 bg-muted/40">
        <RoleGuard>{children}</RoleGuard>
      </main>

    </div>
  );
}