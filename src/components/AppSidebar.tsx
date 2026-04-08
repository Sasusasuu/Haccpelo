import {
  ClipboardCheck,
  Thermometer,
  SprayCan,
  Settings,
  CalendarDays,
  Clock,
  Users,
  LayoutDashboard,
  StickyNote,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

const haccpItems = [
  { title: "Gestion DLC", url: "/haccp/dlc", icon: ClipboardCheck },
  { title: "Températures", url: "/haccp/temperatures", icon: Thermometer },
  { title: "Nettoyage", url: "/haccp/nettoyage", icon: SprayCan },
  { title: "Paramètres HACCP", url: "/haccp/parametres", icon: Settings },
];

const equipeItems = [
  { title: "Planning", url: "/equipe/planning", icon: CalendarDays },
  { title: "Pointeuse", url: "/equipe/pointeuse", icon: Clock },
  { title: "Notes partagées", url: "/equipe/memos", icon: StickyNote },
  { title: "Paramètres Équipe", url: "/equipe/parametres", icon: Users },
];

interface AppSidebarProps {
  onSignOut: () => void;
}

export function AppSidebar({ onSignOut }: AppSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarContent>
        {/* Dashboard */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/" end activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-semibold">
                    <LayoutDashboard className="h-4 w-4" />
                    {!collapsed && <span>Tableau de bord</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* HACCP */}
        <SidebarGroup>
          <SidebarGroupLabel>HACCP</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {haccpItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-semibold">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Équipe */}
        <SidebarGroup>
          <SidebarGroupLabel>Équipe</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {equipeItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-semibold">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2">
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          onClick={onSignOut}
          className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Déconnexion</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
