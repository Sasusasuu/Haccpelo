import { useState, useMemo, useRef } from "react";
import { useEmployees } from "@/hooks/useEmployees";
import { usePlanningSlots } from "@/hooks/usePlanningSlots";
import { useCustomRoles } from "@/hooks/useCustomRoles";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, ChevronRight, Calendar, Copy, FileText, X, Plus } from "lucide-react";
import { DAYS, SLOT_COLORS, fmtShort, getRoleColor, getWeekDates, makeWeekKey, calcSlotMinutes } from "@/lib/constants";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface PlanningModuleProps {
  userId: string;
}

export default function PlanningModule({ userId }: PlanningModuleProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const dates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const weekKey = useMemo(() => makeWeekKey(dates), [dates]);

  const { employees } = useEmployees(userId);
  const { slots, addSlots, deleteSlot, fetchSlotsByWeekKey } = usePlanningSlots(userId, weekKey);
  const { roles } = useCustomRoles(userId);

  const [modal, setModal] = useState<any>(null);
  const [slotForm, setSlotForm] = useState({ start: "10:00", end: "15:00", copyDays: [] as number[], role: "" });
  const [copying, setCopying] = useState(false);

  const weekHours = useMemo(() => {
    const result: Record<string, string> = {};
    employees.forEach((emp: any) => {
      let total = 0;
      slots.filter((s: any) => s.employee_id === emp.id).forEach((s: any) => {
        total += calcSlotMinutes(s.start_time, s.end_time) / 60;
      });
      result[emp.id] = total.toFixed(1);
    });
    return result;
  }, [slots, employees]);

  async function addSlot() {
    if (!modal) return;
    const { empId, dayIdx } = modal;
    const entries = [{ employeeId: empId, dayIndex: dayIdx, startTime: slotForm.start, endTime: slotForm.end, role: slotForm.role || undefined }];
    (slotForm.copyDays || []).forEach((di: number) => {
      entries.push({ employeeId: empId, dayIndex: di, startTime: slotForm.start, endTime: slotForm.end, role: slotForm.role || undefined });
    });
    await addSlots(entries);
    setModal(null);
  }

  async function copyPreviousWeek() {
    if (copying) return;
    setCopying(true);
    try {
      const prevDates = getWeekDates(weekOffset - 1);
      const prevWeekKey = makeWeekKey(prevDates);
      const prevSlots = await fetchSlotsByWeekKey(prevWeekKey);
      if (prevSlots.length === 0) { setCopying(false); return; }
      await addSlots(prevSlots.map((s: any) => ({ employeeId: s.employee_id, dayIndex: s.day_index, startTime: s.start_time, endTime: s.end_time, role: s.role || undefined })));
    } finally { setCopying(false); }
  }

  function exportPDF() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFontSize(14);
    doc.text("Planning — Semaine du " + fmtShort(dates[0]) + " au " + fmtShort(dates[6]) + " " + dates[0].getFullYear(), 14, 18);

    const head = [["Employé", ...DAYS.map((d, i) => d + " " + fmtShort(dates[i])), "Total"]];
    const body = employees.map((emp: any) => {
      const row = [emp.name];
      for (let di = 0; di < 7; di++) {
        const ds = slots.filter((s: any) => s.employee_id === emp.id && s.day_index === di);
        row.push(ds.map((s: any) => `${s.start_time}-${s.end_time}${s.role ? ` (${s.role})` : ""}`).join("\n") || "—");
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

    const finalY = (doc as any).lastAutoTable.finalY + 8;
    doc.setFontSize(8);
    doc.text("Rôles :", 14, finalY);
    let xPos = 32;
    roles.forEach((r: any) => {
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

  return (
    <div className="space-y-4">
      {/* Navigation */}
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

      {/* Planning Grid */}
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
              {employees.map((emp: any, ei: number) => (
                <tr key={emp.id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="p-2 font-medium text-sm">{emp.name}</td>
                  {dates.map((_, dayIdx) => {
                    const daySlots = slots.filter((s: any) => s.employee_id === emp.id && s.day_index === dayIdx);
                    return (
                      <td key={dayIdx} className="p-1 align-top border-l">
                        {daySlots.map((s: any) => {
                          const slotColor = s.role ? getRoleColor(s.role, roles) : SLOT_COLORS[ei % SLOT_COLORS.length];
                          return (
                            <div key={s.id} className="rounded-md px-1.5 py-0.5 mb-0.5 text-[11px]" style={{ background: slotColor + "22", border: `1.5px solid ${slotColor}` }}>
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-medium">{s.start_time}–{s.end_time}</span>
                                <button onClick={() => deleteSlot(s.id)} className="text-muted-foreground hover:text-destructive text-[10px]">✕</button>
                              </div>
                              {s.role && <span className="text-[10px] font-semibold" style={{ color: slotColor }}>{s.role}</span>}
                            </div>
                          );
                        })}
                        <button
                          onClick={() => { setModal({ empId: emp.id, empName: emp.name, dayIdx }); setSlotForm({ start: "10:00", end: "15:00", copyDays: [], role: "" }); }}
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

      {/* Slot Modal */}
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
                  {roles.map((r: any) => (
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
    </div>
  );
}
