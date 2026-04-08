import { useState, useMemo, useCallback } from "react";
import { useEmployees } from "@/hooks/useEmployees";
import { usePlanningSlots } from "@/hooks/usePlanningSlots";
import { useCustomRoles } from "@/hooks/useCustomRoles";
import { useSettings } from "@/hooks/useSettings";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useIdentitySession } from "@/hooks/useIdentitySession";
import IdentifyModal from "@/components/equipe/IdentifyModal";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, ChevronRight, Copy, FileText, Lock, Shield } from "lucide-react";
import { DAYS, SLOT_COLORS, fmtShort, getRoleColor, getWeekDates, makeWeekKey, calcSlotMinutes } from "@/lib/constants";
import { ErrorAlert } from "@/components/ui/error-alert";
import { PlanningGridSkeleton } from "@/components/ui/loading-skeletons";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface PlanningModuleProps {
  userId: string;
}

export default function PlanningModule({ userId }: PlanningModuleProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const dates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const weekKey = useMemo(() => makeWeekKey(dates), [dates]);

  const { employees, error: empError } = useEmployees(userId);
  const { slots, loading, error: slotError, addSlots, deleteSlot, fetchSlotsByWeekKey, retry } = usePlanningSlots(userId, weekKey);
  const { roles } = useCustomRoles(userId);
  const { planningSessionMinutes, verifyPin } = useSettings(userId);
  const { log: auditLog } = useAuditLog(userId);

  const { identifiedEmployee, isIdentified, startSession, clearSession } = useIdentitySession(planningSessionMinutes);
  const [showIdentifyModal, setShowIdentifyModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const [modal, setModal] = useState<{ empId: string; empName: string; dayIdx: number } | null>(null);
  const [slotForm, setSlotForm] = useState({ start: "10:00", end: "15:00", copyDays: [] as number[], role: "" });
  const [copying, setCopying] = useState(false);

  const error = empError || slotError;

  const requireAuth = useCallback((action: () => void) => {
    if (isIdentified) {
      action();
    } else {
      setPendingAction(() => action);
      setShowIdentifyModal(true);
    }
  }, [isIdentified]);

  const handleIdentified = useCallback((emp: import("@/hooks/useEmployees").Employee) => {
    startSession(emp);
    auditLog("planning_unlocked", `Planning déverrouillé par ${emp.name}`, emp.id, emp.name);
    setShowIdentifyModal(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  }, [startSession, auditLog, pendingAction]);

  const weekHours = useMemo(() => {
    const result: Record<string, string> = {};
    employees.forEach((emp) => {
      let total = 0;
      slots.filter(s => s.employee_id === emp.id).forEach(s => {
        total += calcSlotMinutes(s.start_time, s.end_time) / 60;
      });
      result[emp.id] = total.toFixed(1);
    });
    return result;
  }, [slots, employees]);

  function openAddModal(empId: string, empName: string, dayIdx: number) {
    requireAuth(() => {
      setModal({ empId, empName, dayIdx });
      setSlotForm({ start: "10:00", end: "15:00", copyDays: [], role: "" });
    });
  }

  async function addSlot() {
    if (!modal || !identifiedEmployee) return;
    const { empId, dayIdx } = modal;
    const targetEmp = employees.find(e => e.id === empId);
    const entries = [{ employeeId: empId, dayIndex: dayIdx, startTime: slotForm.start, endTime: slotForm.end, role: slotForm.role || undefined }];
    slotForm.copyDays.forEach((di) => {
      entries.push({ employeeId: empId, dayIndex: di, startTime: slotForm.start, endTime: slotForm.end, role: slotForm.role || undefined });
    });
    await addSlots(entries);
    const daysList = [DAYS[dayIdx], ...slotForm.copyDays.map(d => DAYS[d])].join(", ");
    await auditLog("planning_slot_added", `Créneau ${targetEmp?.name ?? ""} ${daysList} ${slotForm.start}-${slotForm.end}${slotForm.role ? ` (${slotForm.role})` : ""}`, identifiedEmployee.id, identifiedEmployee.name);
    setModal(null);
  }

  function handleDeleteSlot(slotId: string, empName: string, dayIdx: number, startTime: string, endTime: string) {
    requireAuth(async () => {
      await deleteSlot(slotId);
      await auditLog("planning_slot_deleted", `Suppression créneau ${empName} ${DAYS[dayIdx]} ${startTime}-${endTime}`, identifiedEmployee?.id ?? null, identifiedEmployee?.name ?? null);
    });
  }

  async function copyPreviousWeek() {
    requireAuth(async () => {
      if (copying) return;
      setCopying(true);
      try {
        const prevDates = getWeekDates(weekOffset - 1);
        const prevWeekKey = makeWeekKey(prevDates);
        const prevSlots = await fetchSlotsByWeekKey(prevWeekKey);
        if (prevSlots.length === 0) return;
        await addSlots(prevSlots.map(s => ({ employeeId: s.employee_id, dayIndex: s.day_index, startTime: s.start_time, endTime: s.end_time, role: s.role || undefined })));
        await auditLog("planning_week_copied", `Copie planning sem. précédente → sem. ${fmtShort(dates[0])}`, identifiedEmployee?.id ?? null, identifiedEmployee?.name ?? null);
      } finally { setCopying(false); }
    });
  }

  function exportPDF() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFontSize(14);
    doc.text("Planning — Semaine du " + fmtShort(dates[0]) + " au " + fmtShort(dates[6]) + " " + dates[0].getFullYear(), 14, 18);

    const head = [["Employé", ...DAYS.map((d, i) => d + " " + fmtShort(dates[i])), "Total"]];
    const body = employees.map((emp) => {
      const row = [emp.name];
      for (let di = 0; di < 7; di++) {
        const ds = slots.filter(s => s.employee_id === emp.id && s.day_index === di);
        row.push(ds.map(s => `${s.start_time}-${s.end_time}${s.role ? ` (${s.role})` : ""}`).join("\n") || "—");
      }
      const total = weekHours[emp.id] || "0";
      const contract = emp.contract_hours;
      row.push(contract ? total + "h / " + contract + "h" : total + "h");
      return row;
    });

    autoTable(doc, {
      head, body, startY: 28, theme: "grid",
      styles: { fontSize: 8, cellPadding: 3, valign: "top" as const },
      headStyles: { fillColor: [17, 17, 17], textColor: 255, fontStyle: "bold", fontSize: 8, halign: "center" as const },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 30 }, 8: { halign: "center" as const, fontStyle: "bold", cellWidth: 28 } },
      alternateRowStyles: { fillColor: [248, 248, 248] },
    });

    const finalY = (doc as unknown as Record<string, { finalY: number }>).lastAutoTable.finalY + 8;
    doc.setFontSize(8);
    doc.text("Rôles :", 14, finalY);
    let xPos = 32;
    roles.forEach((r) => {
      const hex = r.color;
      const rgb: [number, number, number] = [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
      doc.setFillColor(...rgb);
      doc.roundedRect(xPos, finalY - 3, 4, 4, 1, 1, "F");
      doc.text(r.label, xPos + 6, finalY);
      xPos += doc.getTextWidth(r.label) + 12;
    });

    doc.save("planning_" + fmtShort(dates[0]) + "_" + fmtShort(dates[6]) + ".pdf");
  }

  const diff = calcSlotMinutes(slotForm.start, slotForm.end);
  const modalH = Math.floor(diff / 60), modalM = diff % 60;

  if (error) return <ErrorAlert message={error} onRetry={retry} />;
  if (loading) return <PlanningGridSkeleton />;

  return (
    <div className="space-y-4">
      {/* Auth status */}
      {isIdentified && identifiedEmployee && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Shield className="h-4 w-4 text-primary" />
          <span>Modif. autorisées — <strong>{identifiedEmployee.name}</strong></span>
          <Badge variant="outline" className="text-[10px]">{planningSessionMinutes} min</Badge>
          <Button variant="ghost" size="sm" className="h-6 text-xs ml-auto" onClick={clearSession}>
            <Lock className="h-3 w-3 mr-1" /> Verrouiller
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(w => w - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium px-2">
          Semaine du {fmtShort(dates[0])} au {fmtShort(dates[6])}
        </span>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(w => w + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="text-xs" onClick={() => setWeekOffset(0)}>Aujourd'hui</Button>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" className="text-xs" onClick={exportPDF}>
            <FileText className="h-3.5 w-3.5 mr-1" />Export PDF
          </Button>
          <Button variant="outline" size="sm" className="text-xs" onClick={copyPreviousWeek} disabled={copying}>
            <Copy className="h-3.5 w-3.5 mr-1" />{copying ? "Copie..." : "Reproduire sem. préc."}
          </Button>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2 text-xs font-medium text-muted-foreground w-24">Employé</th>
                {dates.map((d, i) => (
                  <th key={i} className="text-center p-2 text-xs font-medium text-muted-foreground">
                    {DAYS[i]}<br /><span className="font-normal">{fmtShort(d)}</span>
                  </th>
                ))}
                <th className="text-center p-2 text-xs font-medium text-muted-foreground w-16">Total</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp, ei) => (
                <tr key={emp.id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="p-2 font-medium text-sm">{emp.name}</td>
                  {dates.map((_, dayIdx) => {
                    const daySlots = slots.filter(s => s.employee_id === emp.id && s.day_index === dayIdx);
                    return (
                      <td key={dayIdx} className="p-1 align-top border-l">
                        {daySlots.map(s => {
                          const slotColor = s.role ? getRoleColor(s.role, roles) : SLOT_COLORS[ei % SLOT_COLORS.length];
                          return (
                            <div key={s.id} className="rounded-md px-1.5 py-0.5 mb-0.5 text-[11px]" style={{ background: slotColor + "22", border: `1.5px solid ${slotColor}` }}>
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-medium">{s.start_time}–{s.end_time}</span>
                                <button onClick={() => handleDeleteSlot(s.id, emp.name, dayIdx, s.start_time, s.end_time)} className="text-muted-foreground hover:text-destructive text-[10px]">✕</button>
                              </div>
                              {s.role && <span className="text-[10px] font-semibold" style={{ color: slotColor }}>{s.role}</span>}
                            </div>
                          );
                        })}
                        <button
                          onClick={() => openAddModal(emp.id, emp.name, dayIdx)}
                          className="text-[11px] text-muted-foreground hover:text-foreground w-full text-center py-0.5"
                        >+ ajouter</button>
                      </td>
                    );
                  })}
                  <td className="text-center border-l p-2">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className={`font-medium ${emp.contract_hours && parseFloat(weekHours[emp.id] || "0") > emp.contract_hours ? "text-destructive" : "text-primary"}`}>
                        {weekHours[emp.id] || "0"}h
                      </span>
                      {emp.contract_hours && (
                        <span className="text-[10px] text-muted-foreground">/ {emp.contract_hours}h</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add slot modal */}
      <Dialog open={!!modal} onOpenChange={() => setModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ajouter un créneau</DialogTitle>
            {modal && <p className="text-sm text-muted-foreground">{modal.empName} · {DAYS[modal.dayIdx]} {fmtShort(dates[modal.dayIdx])}</p>}
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Début</Label>
                <Input type="time" value={slotForm.start} onChange={e => setSlotForm({ ...slotForm, start: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Fin</Label>
                <Input type="time" value={slotForm.end} onChange={e => setSlotForm({ ...slotForm, end: e.target.value })} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Durée : {modalH > 0 ? `${modalH}h` : ""}{modalM > 0 ? `${modalM}min` : ""}
              {diff > 720 && <span className="text-destructive ml-1">⚠️ +12h</span>}
            </p>
            <div className="space-y-1.5">
              <Label>Rôle</Label>
              <Select value={slotForm.role || "__none__"} onValueChange={v => setSlotForm({ ...slotForm, role: v === "__none__" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Aucun rôle" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucun</SelectItem>
                  {roles.map(r => (
                    <SelectItem key={r.id} value={r.label}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded" style={{ background: r.color }} />
                        {r.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {modal && (
              <div className="space-y-1.5">
                <Label className="text-xs">Dupliquer sur d'autres jours</Label>
                <div className="flex gap-2 flex-wrap">
                  {DAYS.map((d, i) => i !== modal.dayIdx && (
                    <label key={i} className="flex items-center gap-1.5 text-xs">
                      <Checkbox
                        checked={slotForm.copyDays.includes(i)}
                        onCheckedChange={(checked) => {
                          setSlotForm(prev => ({
                            ...prev,
                            copyDays: checked ? [...prev.copyDays, i] : prev.copyDays.filter(x => x !== i)
                          }));
                        }}
                      />
                      {d}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(null)}>Annuler</Button>
            <Button onClick={addSlot}>Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Identify Modal */}
      <IdentifyModal
        open={showIdentifyModal}
        onClose={() => { setShowIdentifyModal(false); setPendingAction(null); }}
        employees={employees}
        managersOnly={true}
        onIdentified={handleIdentified}
        verifyManagerPin={verifyPin}
        title="Modification du planning"
        subtitle="Seuls les managers peuvent modifier le planning."
      />
    </div>
  );
}
