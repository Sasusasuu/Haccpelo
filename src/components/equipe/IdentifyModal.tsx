import { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Employee, verifyEmployeePin } from "@/hooks/useEmployees";
import { Nfc } from "lucide-react";
import { toast } from "sonner";

interface NDEFReadingEvent extends Event { serialNumber: string; }
interface NDEFReader { scan(): Promise<void>; addEventListener(type: string, listener: (event: NDEFReadingEvent) => void): void; }
declare const NDEFReader: { new (): NDEFReader } | undefined;

function isNfcSupported(): boolean {
  return typeof window !== "undefined" && "NDEFReader" in window;
}

interface IdentifyModalProps {
  open: boolean;
  onClose: () => void;
  employees: Employee[];
  /** If true, only managers can authenticate */
  managersOnly?: boolean;
  onIdentified: (employee: Employee) => void;
  title?: string;
  subtitle?: string;
  /** Optional: also accept the manager legacy PIN */
  verifyManagerPin?: (pin: string) => boolean;
}

export default function IdentifyModal({ open, onClose, employees, managersOnly = false, onIdentified, title = "Identification requise", subtitle, verifyManagerPin }: IdentifyModalProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPin("");
      setError(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const validate = useCallback(() => {
    const candidates = managersOnly ? employees.filter(e => e.is_manager) : employees;
    const match = candidates.find(emp => emp.pin_hash && verifyEmployeePin(emp, pin));
    if (match) {
      onIdentified(match);
      setPin("");
    } else {
      setError(true);
      setPin("");
      setTimeout(() => setError(false), 1500);
    }
  }, [pin, employees, managersOnly, onIdentified]);

  const handleNfc = useCallback(async () => {
    if (!isNfcSupported()) {
      toast.error("NFC non disponible sur cet appareil.");
      return;
    }
    try {
      const reader = new NDEFReader!();
      await reader.scan();
      toast.info("Approchez votre badge NFC…");
      reader.addEventListener("reading", ((event: NDEFReadingEvent) => {
        const badgeId = event.serialNumber || "";
        const candidates = managersOnly ? employees.filter(e => e.is_manager) : employees;
        const match = candidates.find(e => e.nfc_badge_id === badgeId);
        if (match) {
          onIdentified(match);
        } else {
          toast.error("Badge non reconnu" + (managersOnly ? " ou pas manager" : ""));
        }
      }) as EventListener);
    } catch {
      toast.error("Impossible d'activer le NFC.");
    }
  }, [employees, managersOnly, onIdentified]);

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          {managersOnly && <p className="text-xs text-muted-foreground">Managers uniquement</p>}
        </DialogHeader>
        <Input
          ref={inputRef}
          type="password"
          maxLength={4}
          value={pin}
          onChange={e => setPin(e.target.value)}
          onKeyDown={e => e.key === "Enter" && validate()}
          placeholder="Code PIN à 4 chiffres"
          className={`text-center text-xl tracking-[10px] ${error ? "border-destructive bg-destructive/10" : ""}`}
        />
        {error && <p className="text-xs text-destructive text-center">Code incorrect{managersOnly ? " ou pas manager" : ""}</p>}
        <DialogFooter className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleNfc} className="gap-1">
            <Nfc className="h-4 w-4" /> Badge NFC
          </Button>
          <div className="flex-1" />
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={validate}>Valider</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
