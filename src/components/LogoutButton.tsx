import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LogoutButtonProps {
  onSignOut: () => void;
  className?: string;
}

export default function LogoutButton({ onSignOut, className = "" }: LogoutButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onSignOut}
      className={`text-muted-foreground hover:text-destructive ${className}`}
    >
      <LogOut className="h-4 w-4 mr-1.5" />
      Déconnexion
    </Button>
  );
}
