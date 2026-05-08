import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Sidebar from "@/components/sidebar";
import TopBar from "@/components/top-bar";

export default async function PainelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={user} />
      <div className="flex-1 overflow-hidden flex flex-col">
        <TopBar />
        <main className="flex-1 overflow-hidden flex flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}
