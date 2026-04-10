import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Separator } from "@/components/ui/separator";

interface TopBarProps {
  title?: string;
  establishmentName?: string;
}

export function TopBar({ title, establishmentName }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-6" />
      <div className="flex flex-1 items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">{establishmentName || "Mon établissement"}</h1>
          {title && <p className="text-xs text-muted-foreground hidden sm:block">{title}</p>}
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
