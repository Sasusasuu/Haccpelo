import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { OfflineBanner } from "@/components/OfflineBanner";

interface AppLayoutProps {
  children: React.ReactNode;
  onSignOut: () => void;
  establishmentName?: string;
}

export function AppLayout({ children, onSignOut, establishmentName }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar onSignOut={onSignOut} />
        <div className="flex-1 flex flex-col min-w-0">
          <OfflineBanner />
          <TopBar establishmentName={establishmentName} onSignOut={onSignOut} />
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
