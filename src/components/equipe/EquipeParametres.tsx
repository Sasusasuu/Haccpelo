import { useState } from "react";
import { useEmployees } from "@/hooks/useEmployees";
import { useSettings } from "@/hooks/useSettings";
import { useCustomRoles } from "@/hooks/useCustomRoles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Lock, Plus, Pencil, Trash2, X, Check, Users, LogOut, Eye, EyeOff, Download } from "lucide-react";
import { DAYS, calcSlotMinutes } from "@/lib/constants";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface EquipeParametresProps {
  userId: string;
  onSignOut: () => void;
}

export default function EquipeParametres({ userId, onSignOut }: EquipeParametresProps) {
  const { employees, addEmployee, updateEmployee, deleteEmployee } = useEmployees(userId);
  const { verifyPin, changePin } = useSettings(userId);
  const { roles, addRole, updateRole, deleteRole } = useCustomRoles(userId);

  const [settingsUnlocked, setSettingsUnlocked] = useState(false);
  const [settingsPin, setSettingsPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [newEmp, setNewEmp] = useState("");
  const [showRegistre, setShowRegistre] = useState(false);
  const [newRoleLabel, setNewRoleLabel] = useState("");
  const [newRoleColor, setNewRoleColor] = useState("#2563eb");
  const [editRoleId, setEditRoleId] = useState<string | null>(null);
  const [editRoleLabel, setEditRoleLabel] = useState("");
  const [editRoleColor, setEditRoleColor] = useState("");

  // Export comptable state
  const [exportMonth, setExportMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [exporting, setExporting] = useState(false);

  function tryUnlock() {
    if (verifyPin(settingsPin)) { setSettingsUnlocked(true); setSettingsPin(""); setPinError(false); }
    else { setPinError(true); setSettingsPin(""); setTimeout(() => setPinError(false), 1500); }
  }

  const mealTypeLabel = (type: string | null) => {
    if (type === "avantage_nature") return "Avantage en nature";
    if (type === "repas_entreprise") return "Repas en entreprise";
    return "—";
  };

  async function exportComptable() {
    if (exporting) return;
    setExporting(true);
    try {
      const [year, month] = exportMonth.split("-").map(Number);
      
      // Get all weeks that overlap with the selected month
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0);
      
      // Fetch all planning slots for this month
      const { data: allSlots } = await supabase
        .from("planning_slots")
        .select("employee_id, day_index, start_time, end_time, role, week_key")
        .eq("user_id", userId);
      
      if (!allSlots) { setExporting(false); return; }

      // Filter slots that fall within the month
      const monthSlots = allSlots.filter(s => {
        const [wkYear, wkNum] = s.week_key.split("-W").map(Number);
        // Get Monday of that week
        const jan1 = new Date(wkYear, 0, 1);
        const dayOfWeek = jan1.getDay() || 7;
        const mondayOfWeek = new Date(wkYear, 0, 1 + (wkNum - 1) * 7 - dayOfWeek + 1);
        const slotDate = new Date(mondayOfWeek);
        slotDate.setDate(slotDate.getDate() + s.day_index);
        return slotDate >= firstDay && slotDate <= lastDay;
      });

      const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      doc.setFontSize(14);
      doc.text(`Export Comptable — ${monthNames[month - 1]} ${year}`, 14, 18);

      // Build table data per employee
      const head = [["Employé", "Heures contrat", "Heures travaillées", "Nb jours travaillés", "Type repas", "Nb repas"]];
      const body = employees.map((emp: any) => {
        const empSlots = monthSlots.filter(s => s.employee_id === emp.id);
        let totalMinutes = 0;
        const workedDays = new Set<string>();
        empSlots.forEach(s => {
          totalMinutes += calcSlotMinutes(s.start_time, s.end_time);
          workedDays.add(`${s.week_key}-${s.day_index}`);
        });
        const totalHours = (totalMinutes / 60).toFixed(1);
        const nbRepas = workedDays.size;

        return [
          emp.name,
          emp.contract_hours ? `${emp.contract_hours}h/sem` : "—",
          `${totalHours}h`,
          String(workedDays.size),
          mealTypeLabel(emp.meal_type),
          String(nbRepas),
        ];
      });

      autoTable(doc, {
        head, body, startY: 28, theme: "grid",
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [17, 17, 17], textColor: 255, fontStyle: "bold", fontSize: 9, halign: "center" as const },
        columnStyles: { 0: { fontStyle: "bold" } },
        alternateRowStyles: { fillColor: [248, 248, 248] },
      });

      // Detail per employee - daily breakdown
      employees.forEach((emp: any) => {
        const empSlots = monthSlots.filter(s => s.employee_id === emp.id);
        if (empSlots.length === 0) return;
        
        doc.addPage();
        doc.setFontSize(12);
        doc.text(`Détail — ${emp.name} — ${monthNames[month - 1]} ${year}`, 14, 18);
        if (emp.meal_type) {
          doc.setFontSize(9);
          doc.text(`Type repas : ${mealTypeLabel(emp.meal_type)}`, 14, 25);
        }

        // Group slots by date
        const slotsByDate: Record<string, typeof empSlots> = {};
        empSlots.forEach(s => {
          const [wkYear, wkNum] = s.week_key.split("-W").map(Number);
          const jan1 = new Date(wkYear, 0, 1);
          const dayOfWeek = jan1.getDay() || 7;
          const mondayOfWeek = new Date(wkYear, 0, 1 + (wkNum - 1) * 7 - dayOfWeek + 1);
          const slotDate = new Date(mondayOfWeek);
          slotDate.setDate(slotDate.getDate() + s.day_index);
          const key = slotDate.toISOString().slice(0, 10);
          if (!slotsByDate[key]) slotsByDate[key] = [];
          slotsByDate[key].push(s);
        });

        const sortedDates = Object.keys(slotsByDate).sort();
        const detailHead = [["Date", "Horaires", "Heures", "Repas"]];
        const detailBody = sortedDates.map(dateStr => {
          const d = new Date(dateStr);
          const dayName = DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1];
          const slotsForDay = slotsByDate[dateStr];
          const horaires = slotsForDay.map(s => `${s.start_time}-${s.end_time}`).join(", ");
          let mins = 0;
          slotsForDay.forEach(s => { mins += calcSlotMinutes(s.start_time, s.end_time); });
          return [
            `${dayName} ${dateStr.slice(8)}/${dateStr.slice(5, 7)}`,
            horaires,
            `${(mins / 60).toFixed(1)}h`,
            "1",
          ];
        });

        // Totals row
        let totalMins = 0;
        empSlots.forEach(s => { totalMins += calcSlotMinutes(s.start_time, s.end_time); });
        detailBody.push(["TOTAL", "", `${(totalMins / 60).toFixed(1)}h`, String(sortedDates.length)]);

        autoTable(doc, {
          head: detailHead, body: detailBody, startY: emp.meal_type ? 30 : 25, theme: "grid",
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [50, 50, 50], textColor: 255, fontSize: 8, halign: "center" as const },
          columnStyles: { 0: { fontStyle: "bold" } },
          alternateRowStyles: { fillColor: [248, 248, 248] },
        });
      });

      doc.save(`export_comptable_${monthNames[month - 1]}_${year}.pdf`);
    } finally {
      setExporting(false);
    }
  }

  if (!settingsUnlocked) {
    return (
      <Card className="max-w-md">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Lock className="h-4 w-4" /> Code manager requis</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input type="password" maxLength={4} value={settingsPin} onChange={e => setSettingsPin(e.target.value)} onKeyDown={e => e.key === "Enter" && tryUnlock()} placeholder="••••" className={`text-center text-lg tracking-[6px] ${pinError ? "border-destructive" : ""}`} />
            <Button onClick={tryUnlock}>Accéder</Button>
          </div>
          {pinError && <p className="text-xs text-destructive mt-2">Code incorrect</p>}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 max-w-xl">
      {/* PIN */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Code manager</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input type="password" maxLength={4} value={newPin} onChange={e => setNewPin(e.target.value)} placeholder="Nouveau code (4 chiffres)" />
            <Button variant="outline" onClick={async () => { if (newPin.length === 4) { await changePin(newPin); setNewPin(""); } }}>Enregistrer</Button>
          </div>
        </CardContent>
      </Card>

      {/* Employés */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> Employés</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {employees.map((emp: any) => (
            <div key={emp.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg flex-wrap">
              <span className="flex-1 text-sm font-medium min-w-[80px]">{emp.name}</span>
              <Input type="number" min={0} max={48} value={emp.contract_hours || ""} onChange={e => updateEmployee(emp.id, { contract_hours: e.target.value ? parseFloat(e.target.value) : null })} placeholder="h/sem" className="w-16 h-8 text-center text-xs" />
              <span className="text-xs text-muted-foreground">h/sem</span>
              <Select value={emp.meal_type || "none"} onValueChange={v => updateEmployee(emp.id, { meal_type: v === "none" ? null : v })}>
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <SelectValue placeholder="Type repas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  <SelectItem value="avantage_nature">Avantage en nature</SelectItem>
                  <SelectItem value="repas_entreprise">Repas en entreprise</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteEmployee(emp.id)}><Trash2 className="h-3 w-3" /></Button>
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <Input value={newEmp} onChange={e => setNewEmp(e.target.value)} onKeyDown={async e => { if (e.key === "Enter" && newEmp.trim()) { await addEmployee(newEmp.trim()); setNewEmp(""); } }} placeholder="Prénom du nouvel employé" className="flex-1" />
            <Button onClick={async () => { if (newEmp.trim()) { await addEmployee(newEmp.trim()); setNewEmp(""); } }}><Plus className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      {/* Registre */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">📋 Registre du personnel</CardTitle>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowRegistre(v => !v)}>
              {showRegistre ? <><EyeOff className="h-3 w-3 mr-1" />Masquer</> : <><Eye className="h-3 w-3 mr-1" />Afficher</>}
            </Button>
          </div>
        </CardHeader>
        <Collapsible open={showRegistre} onOpenChange={setShowRegistre}>
          <CollapsibleContent>
            <CardContent>
              {employees.length === 0 ? (
                <p className="text-sm text-muted-foreground p-2">Aucun employé enregistré</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Nom / Prénom</TableHead>
                      <TableHead className="text-center">Heures contrat</TableHead>
                      <TableHead className="text-center">Type repas</TableHead>
                      <TableHead className="text-center">Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((emp: any, i: number) => (
                      <TableRow key={emp.id}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{emp.name}</TableCell>
                        <TableCell className="text-center">{emp.contract_hours ? `${emp.contract_hours}h/sem` : "—"}</TableCell>
                        <TableCell className="text-center text-xs">{mealTypeLabel(emp.meal_type)}</TableCell>
                        <TableCell className="text-center"><Badge variant="outline" className="border-green-500 text-green-600">Actif</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <p className="text-xs text-muted-foreground italic mt-2">📌 Ce registre est obligatoire (Article L1221-13 du Code du travail).</p>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Rôles */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">🎯 Rôles du planning</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {roles.map((r: any) => (
            <div key={r.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
              {editRoleId === r.id ? (
                <>
                  <Input value={editRoleLabel} onChange={e => setEditRoleLabel(e.target.value)} className="flex-1 h-8" />
                  <input type="color" value={editRoleColor} onChange={e => setEditRoleColor(e.target.value)} className="w-8 h-7 border-none rounded cursor-pointer p-0" />
                  <Button size="icon" className="h-8 w-8" onClick={async () => { await updateRole(r.id, { label: editRoleLabel, color: editRoleColor }); setEditRoleId(null); }}><Check className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditRoleId(null)}><X className="h-3 w-3" /></Button>
                </>
              ) : (
                <>
                  <div className="w-4 h-4 rounded shrink-0" style={{ background: r.color }} />
                  <span className="flex-1 text-sm">{r.label}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditRoleId(r.id); setEditRoleLabel(r.label); setEditRoleColor(r.color); }}><Pencil className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteRole(r.id)}><Trash2 className="h-3 w-3" /></Button>
                </>
              )}
            </div>
          ))}
          {roles.length === 0 && <p className="text-sm text-muted-foreground p-2">Aucun rôle configuré</p>}
          <div className="flex gap-2 pt-2">
            <Input value={newRoleLabel} onChange={e => setNewRoleLabel(e.target.value)} onKeyDown={async e => { if (e.key === "Enter" && newRoleLabel.trim()) { await addRole(newRoleLabel.trim(), newRoleColor); setNewRoleLabel(""); } }} placeholder="Nom du rôle" className="flex-1" />
            <input type="color" value={newRoleColor} onChange={e => setNewRoleColor(e.target.value)} className="w-9 h-10 border-none rounded cursor-pointer p-0" />
            <Button onClick={async () => { if (newRoleLabel.trim()) { await addRole(newRoleLabel.trim(), newRoleColor); setNewRoleLabel(""); } }}><Plus className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      {/* Export Comptable */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Download className="h-4 w-4" /> Export pour comptable</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Exporte un PDF mensuel avec les horaires de chaque employé, le total d'heures et le nombre de repas (avantage en nature ou repas en entreprise).
          </p>
          <div className="flex gap-2 items-end">
            <div className="space-y-1">
              <label className="text-xs font-medium">Mois</label>
              <Input type="month" value={exportMonth} onChange={e => setExportMonth(e.target.value)} className="w-[180px] h-9" />
            </div>
            <Button onClick={exportComptable} disabled={exporting} className="h-9">
              <Download className="h-4 w-4 mr-1.5" />
              {exporting ? "Export..." : "Exporter PDF"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setSettingsUnlocked(false)}>
          <Lock className="h-4 w-4 mr-2" />Verrouiller
        </Button>
        <Button variant="destructive" onClick={onSignOut}>
          <LogOut className="h-4 w-4 mr-2" />Déconnexion
        </Button>
      </div>
    </div>
  );
}
