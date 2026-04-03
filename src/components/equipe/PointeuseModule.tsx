import { useState, useRef, useMemo } from "react";
import { useEmployees } from "@/hooks/useEmployees";
import { useTimeEntries } from "@/hooks/useTimeEntries";
import { useSettings } from "@/hooks/useSettings";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Clock, Play, Square } from "lucide-react";
import { SLOT_COLORS, fmtTime, diffH, fmtDuration } from "@/lib/constants";

interface PointeuseModuleProps {
  userId: string;
}

export default function PointeuseModule({ userId }: PointeuseModuleProps) {
  const { employees } = useEmployees(userId);
  const { entries, clockIn, clockOut } = useTimeEntries(userId);
  const { verifyPin } = useSettings(userId);

  const [pinModal, setPinModal] = useState<any>(null);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const pinRef = useRef<HTMLInputElement>(null);

  const today = new Date().toISOString().split("T")[0];

  function getEmployeeStatus(empId: string) {
    const todayEntries = entries.filter((e: any) => e.employee_id === empId && e.work_date === today);
    const openEntry = todayEntries.find((e: any) => e.arrival_ts && !e.departure_ts);
    return { isIn: !!openEntry, openEntry, todayEntries };
  }

  function getDayTotal(empId: string) {
    const todayEntries = entries.filter((e: any) => e.employee_id === empId && e.work_date === today);
    let total = 0;
    todayEntries.forEach((e: any) => {
      if (e.arrival_ts && e.departure_ts) total += diffH(e.arrival_ts, e.departure_ts);
      else if (e.arrival_ts) total += diffH(e.arrival_ts, Date.now());
    });
    return total;
  }

  function openPinModal(emp: any) {
    const { isIn } = getEmployeeStatus(emp.id);
    setPinModal({ emp, action: isIn ? "fin de shift" : "début de shift" });
    setPinInput(""); setPinError(false);
    setTimeout(() => pinRef.current?.focus(), 100);
  }

  async function validatePin() {
    if (verifyPin(pinInput)) {
      const { isIn, openEntry } = getEmployeeStatus(pinModal.emp.id);
      if (isIn && openEntry) await clockOut(openEntry.id);
      else await clockIn(pinModal.emp.id);
      setPinModal(null); setPinInput("");
    } else {
      setPinError(true); setPinInput(""); setTimeout(() => setPinError(false), 1500);
    }
  }

  function getHistory(empId: string) {
    return entries.filter((e: any) => e.employee_id === empId && e.departure_ts)
      .sort((a: any, b: any) => b.work_date.localeCompare(a.work_date)).slice(0, 10);
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Clock className="h-5 w-5" /> Pointeuse
        </h2>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      <div className="grid gap-3">
        {employees.map((emp: any, ei: number) => {
          const { isIn, todayEntries, openEntry } = getEmployeeStatus(emp.id);
          const total = getDayTotal(emp.id);
          const completedSessions = todayEntries.filter((e: any) => e.arrival_ts && e.departure_ts);
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
                        {isIn ? `En service depuis ${fmtTime(openEntry?.arrival_ts)}` : todayEntries.length > 0 ? "Service terminé" : "Pas encore pointé"}
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
                      onClick={() => openPinModal(emp)}
                      className={!isIn ? "bg-green-600 hover:bg-green-700" : ""}
                    >
                      {isIn ? <><Square className="h-3.5 w-3.5 mr-1" />Fin</> : <><Play className="h-3.5 w-3.5 mr-1" />Début</>}
                    </Button>
                  </div>
                </div>
                {completedSessions.length > 0 && (
                  <div className="mt-3 pt-3 border-t flex gap-2 flex-wrap">
                    {completedSessions.map((s: any) => (
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

      {/* History */}
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
              {employees.flatMap((emp: any) => getHistory(emp.id).map((entry: any) => (
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

      {/* PIN Dialog */}
      <Dialog open={!!pinModal} onOpenChange={() => setPinModal(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Validation manager</DialogTitle>
            {pinModal && <p className="text-sm text-muted-foreground">{pinModal.emp.name} — <strong>{pinModal.action}</strong></p>}
          </DialogHeader>
          <Input
            ref={pinRef} type="password" maxLength={4} value={pinInput}
            onChange={e => setPinInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && validatePin()}
            placeholder="Code à 4 chiffres"
            className={`text-center text-xl tracking-[10px] ${pinError ? "border-destructive bg-destructive/10" : ""}`}
          />
          {pinError && <p className="text-xs text-destructive text-center">Code incorrect</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPinModal(null)}>Annuler</Button>
            <Button onClick={validatePin}>Valider</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
