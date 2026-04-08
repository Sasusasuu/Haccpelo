import { useState, useRef, useCallback } from "react";
import { useEmployees, verifyEmployeePin } from "@/hooks/useEmployees";
import { useTimeEntries } from "@/hooks/useTimeEntries";
import { useAuditLog } from "@/hooks/useAuditLog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Play, Square, Nfc, CheckCircle2, AlertTriangle } from "lucide-react";
import { SLOT_COLORS, fmtTime, diffH, fmtDuration } from "@/lib/constants";
import { ErrorAlert } from "@/components/ui/error-alert";
import { ListSkeleton } from "@/components/ui/loading-skeletons";
import { toast } from "sonner";

interface TimeclockModuleProps {
  userId: string;
}

// Web NFC type declarations
interface NDEFMessage { records: NDEFRecord[]; }
interface NDEFRecord { recordType: string; data?: ArrayBuffer; }
interface NDEFReadingEvent extends Event { serialNumber: string; message: NDEFMessage; }
interface NDEFReader { scan(): Promise<void>; addEventListener(type: "reading", listener: (event: NDEFReadingEvent) => void): void; addEventListener(type: "readingerror", listener: (event: Event) => void): void; }
declare const NDEFReader: { new (): NDEFReader } | undefined;

function isNfcSupported(): boolean {
  return typeof window !== "undefined" && "NDEFReader" in window;
}

export default function TimeclockModule({ userId }: TimeclockModuleProps) {
  const { employees, loading: empLoading, error: empError, retry: empRetry, updateEmployee } = useEmployees(userId);
  const { entries, loading: entriesLoading, error: entriesError, clockIn, clockOut, retry: entriesRetry } = useTimeEntries(userId);
  const { log: auditLog } = useAuditLog(userId);

  const [pinModal, setPinModal] = useState<{ emp: { id: string; name: string }; action: string } | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const pinRef = useRef<HTMLInputElement>(null);

  // NFC scan state
  const [nfcScanning, setNfcScanning] = useState(false);
  const [nfcResult, setNfcResult] = useState<{ empName: string; time: string; action: string } | null>(null);
  const [nfcAssignModal, setNfcAssignModal] = useState<{ badgeId: string } | null>(null);
  const [nfcAssignEmpId, setNfcAssignEmpId] = useState("");

  const today = new Date().toISOString().split("T")[0];
  const loading = empLoading || entriesLoading;
  const error = empError || entriesError;

  function getEmployeeStatus(empId: string) {
    const todayEntries = entries.filter(e => e.employee_id === empId && e.work_date === today);
    const openEntry = todayEntries.find(e => e.arrival_ts && !e.departure_ts);
    return { isIn: !!openEntry, openEntry, todayEntries };
  }

  function getDayTotal(empId: string) {
    const todayEntries = entries.filter(e => e.employee_id === empId && e.work_date === today);
    let total = 0;
    todayEntries.forEach(e => {
      if (e.arrival_ts && e.departure_ts) total += diffH(e.arrival_ts, e.departure_ts);
      else if (e.arrival_ts) total += diffH(e.arrival_ts, Date.now());
    });
    return total;
  }

  function openPinModal(emp: { id: string; name: string }) {
    const { isIn } = getEmployeeStatus(emp.id);
    setPinModal({ emp, action: isIn ? "fin de shift" : "début de shift" });
    setPinInput(""); setPinError(false);
    setTimeout(() => pinRef.current?.focus(), 100);
  }

  async function validatePin() {
    if (!pinModal) return;
    const emp = employees.find(e => e.id === pinModal.emp.id);
    if (!emp) return;

    // Verify the employee's own PIN (async — must await)
    const pinValid = emp.pin_hash ? await verifyEmployeePin(emp, pinInput) : false;
    if (pinValid) {
      const { isIn, openEntry } = getEmployeeStatus(pinModal.emp.id);
      if (isIn && openEntry) {
        await clockOut(openEntry.id);
        await auditLog("clock_out", `Fin de shift — ${emp.name}`, emp.id, emp.name);
      } else {
        await clockIn(pinModal.emp.id);
        await auditLog("clock_in", `Début de shift — ${emp.name}`, emp.id, emp.name);
      }
      setPinModal(null); setPinInput("");
    } else {
      setPinError(true); setPinInput(""); setTimeout(() => setPinError(false), 1500);
    }
  }

  function getHistory(empId: string) {
    return entries.filter(e => e.employee_id === empId && e.departure_ts)
      .sort((a, b) => b.work_date.localeCompare(a.work_date)).slice(0, 10);
  }

  const handleNfcScan = useCallback(async () => {
    if (!isNfcSupported()) {
      toast.error("NFC non disponible", {
        description: "Votre appareil ou navigateur ne supporte pas le NFC. Utilisez Chrome sur Android.",
      });
      return;
    }

    setNfcScanning(true);
    setNfcResult(null);

    try {
      const reader = new NDEFReader!();
      await reader.scan();
      toast.info("Approchez le badge NFC de l'appareil…");

      reader.addEventListener("reading", async (event: NDEFReadingEvent) => {
        const badgeId = event.serialNumber || "unknown";
        setNfcScanning(false);

        const emp = employees.find(e => e.nfc_badge_id === badgeId);
        if (!emp) {
          setNfcAssignModal({ badgeId });
          setNfcAssignEmpId("");
          return;
        }

        const { isIn, openEntry } = getEmployeeStatus(emp.id);
        const now = new Date();
        const timeStr = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

        if (isIn && openEntry) {
          await clockOut(openEntry.id);
          await auditLog("clock_out", `Fin de shift (badge NFC) — ${emp.name}`, emp.id, emp.name);
          setNfcResult({ empName: emp.name, time: timeStr, action: "Fin de shift" });
        } else {
          await clockIn(emp.id);
          await auditLog("clock_in", `Début de shift (badge NFC) — ${emp.name}`, emp.id, emp.name);
          setNfcResult({ empName: emp.name, time: timeStr, action: "Début de shift" });
        }
      });

      reader.addEventListener("readingerror", () => {
        setNfcScanning(false);
        toast.error("Erreur de lecture NFC", { description: "Impossible de lire le badge. Réessayez." });
      });
    } catch {
      setNfcScanning(false);
      toast.error("Erreur NFC", { description: "Impossible d'activer le lecteur NFC." });
    }
  }, [employees, entries, clockIn, clockOut, auditLog]);

  async function assignBadge() {
    if (!nfcAssignModal || !nfcAssignEmpId) return;
    await updateEmployee(nfcAssignEmpId, { nfc_badge_id: nfcAssignModal.badgeId });
    const emp = employees.find(e => e.id === nfcAssignEmpId);
    toast.success(`Badge associé à ${emp?.name ?? "l'employé"}`);
    setNfcAssignModal(null);
    setNfcAssignEmpId("");
  }

  if (error) return <ErrorAlert message={error} onRetry={empRetry || entriesRetry} />;
  if (loading) return <ListSkeleton rows={4} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5" /> Pointeuse
          </h2>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <Button variant="outline" onClick={handleNfcScan} disabled={nfcScanning} className="gap-2">
          <Nfc className="h-4 w-4" />
          {nfcScanning ? "Scan en cours…" : "Scanner mon badge"}
        </Button>
      </div>

      {nfcResult && (
        <Card className="border-green-500/50 bg-green-50 dark:bg-green-950/20">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 shrink-0" />
            <div>
              <p className="font-semibold text-green-800 dark:text-green-300">{nfcResult.empName}</p>
              <p className="text-sm text-green-700 dark:text-green-400">{nfcResult.action} — {nfcResult.time}</p>
            </div>
            <Button variant="ghost" size="sm" className="ml-auto text-xs" onClick={() => setNfcResult(null)}>Fermer</Button>
          </CardContent>
        </Card>
      )}

      {!isNfcSupported() && nfcScanning && (
        <Card className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <p className="text-sm text-yellow-800 dark:text-yellow-300">NFC non disponible sur cet appareil. Utilisez Chrome sur Android.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {employees.map((emp, ei) => {
          const { isIn, todayEntries, openEntry } = getEmployeeStatus(emp.id);
          const total = getDayTotal(emp.id);
          const completedSessions = todayEntries.filter(e => e.arrival_ts && e.departure_ts);
          const hasPin = !!emp.pin_hash;
          return (
            <Card key={emp.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold" style={{ background: SLOT_COLORS[ei % SLOT_COLORS.length] + "22", color: SLOT_COLORS[ei % SLOT_COLORS.length], border: `1px solid ${SLOT_COLORS[ei % SLOT_COLORS.length]}` }}>
                      {emp.name[0]}
                    </div>
                    <div>
                      <p className="font-semibold">{emp.name}</p>
                      <p className={`text-xs ${isIn ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                        {isIn ? `En service depuis ${fmtTime(openEntry?.arrival_ts ?? null)}` : todayEntries.length > 0 ? "Service terminé" : "Pas encore pointé"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Aujourd'hui</p>
                      <p className="font-semibold">{fmtDuration(total)}</p>
                    </div>
                    <Button
                      variant={isIn ? "destructive" : "default"}
                      size="sm"
                      onClick={() => hasPin ? openPinModal(emp) : toast.error(`Aucun PIN défini pour ${emp.name}. Configurez-le dans les paramètres.`)}
                      className={!isIn ? "bg-green-600 hover:bg-green-700" : ""}
                    >
                      {isIn ? <><Square className="h-3.5 w-3.5 mr-1" />Fin</> : <><Play className="h-3.5 w-3.5 mr-1" />Début</>}
                    </Button>
                  </div>
                </div>
                {completedSessions.length > 0 && (
                  <div className="mt-3 pt-3 border-t flex gap-2 flex-wrap">
                    {completedSessions.map(s => (
                      <Badge key={s.id} variant="secondary" className="text-xs font-normal">
                        {fmtTime(s.arrival_ts)} → {fmtTime(s.departure_ts)} ({fmtDuration(diffH(s.arrival_ts, s.departure_ts))})
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Historique récent</h3>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employé</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Durée</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.flatMap(emp => getHistory(emp.id).map(entry => (
                <TableRow key={entry.id}>
                  <TableCell>{emp.name}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(entry.work_date).toLocaleDateString("fr-FR")}</TableCell>
                  <TableCell className="font-medium">{fmtDuration(diffH(entry.arrival_ts, entry.departure_ts))}</TableCell>
                </TableRow>
              )))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* PIN Modal — employee's own PIN */}
      <Dialog open={!!pinModal} onOpenChange={() => setPinModal(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Votre code PIN</DialogTitle>
            {pinModal && <p className="text-sm text-muted-foreground">{pinModal.emp.name} — <strong>{pinModal.action}</strong></p>}
          </DialogHeader>
          <Input
            ref={pinRef} type="password" maxLength={4} value={pinInput}
            onChange={e => setPinInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && validatePin()}
            placeholder="Votre code à 4 chiffres"
            className={`text-center text-xl tracking-[10px] ${pinError ? "border-destructive bg-destructive/10" : ""}`}
          />
          {pinError && <p className="text-xs text-destructive text-center">Code incorrect</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPinModal(null)}>Annuler</Button>
            <Button onClick={validatePin}>Valider</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* NFC Badge Assignment Modal */}
      <Dialog open={!!nfcAssignModal} onOpenChange={() => setNfcAssignModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Badge non reconnu</DialogTitle>
            <p className="text-sm text-muted-foreground">Ce badge n'est associé à aucun employé. Voulez-vous l'attribuer ?</p>
          </DialogHeader>
          <Select value={nfcAssignEmpId} onValueChange={setNfcAssignEmpId}>
            <SelectTrigger><SelectValue placeholder="Choisir un employé" /></SelectTrigger>
            <SelectContent>
              {employees.filter(e => !e.nfc_badge_id).map(emp => (
                <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNfcAssignModal(null)}>Annuler</Button>
            <Button onClick={assignBadge} disabled={!nfcAssignEmpId}>Associer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
