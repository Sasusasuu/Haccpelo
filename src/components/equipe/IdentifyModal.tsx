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
  /** Optional: also accept the manager legacy PIN (async) */
  verifyManagerPin?: (pin: string) => Promise<boolean>;
}

export default function IdentifyModal({ open, onClose, employees, managersOnly = false, onIdentified, title = "Identification requise", subtitle, verifyManagerPin }: IdentifyModalProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [validating, setValidating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPin("");
      setError(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const validate = useCallback(async () => {
    if (validating) return;
    setValidating(true);
    try {
      const candidates = managersOnly ? employees.filter(e => e.is_manager) : employees;
      const hasPins = candidates.some(e => e.pin_hash) || verifyManagerPin;

      if (!hasPins) {
        toast.error("Aucun PIN configuré. Demandez à un manager de définir les codes PIN dans les paramètres.");
        setValidating(false);
        return;
      }

      // Check employee PINs
      for (const emp of candidates) {
        if (emp.pin_hash) {
          const match = await verifyEmployeePin(emp, pin);
          if (match) {
            onIdentified(emp);
            setPin("");
            setValidating(false);
            return;
          }
        }
      }

      // Fallback: legacy manager PIN
      if (verifyManagerPin) {
        const isManager = await verifyManagerPin(pin);
        if (isManager) {
          onIdentified({ id: "", name: "Manager", contract_hours: null, meal_type: null, nfc_badge_id: null, pin_hash: null, is_manager: true });
          setPin("");
          setValidating(false);
          return;
        }
      }

      setError(true);
      setPin("");
      setTimeout(() => setError(false), 1500);
    } finally {
      setValidating(false);
    }
  }, [pin, employees, managersOnly, onIdentified, verifyManagerPin, validating]);

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
      <DialogContent className="max-w-sm w-[90vw]">
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
          placeholder="Code PIN"
          className={`text-center text-xl tracking-[10px] ${error ? "border-destructive bg-destructive/10" : ""}`}
          disabled={validating}
        />
        {error && <p className="text-xs text-destructive text-center">Code incorrect{managersOnly ? " ou pas manager" : ""}</p>}
        {validating && <p className="text-xs text-muted-foreground text-center">Vérification…</p>}
        <DialogFooter className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleNfc} className="gap-1">
            <Nfc className="h-4 w-4" /> Badge NFC
          </Button>
          <div className="flex-1" />
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={validate} disabled={validating}>{validating ? "…" : "Valider"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
