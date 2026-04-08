import { useState } from "react";
import { useEmployees, hashEmployeePin, verifyEmployeePin } from "@/hooks/useEmployees";
import { useSettings } from "@/hooks/useSettings";
import { useCustomRoles } from "@/hooks/useCustomRoles";
import { useAuditLog } from "@/hooks/useAuditLog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { Lock, Plus, Pencil, Trash2, X, Check, Users, LogOut, Eye, EyeOff, Download, ScrollText, Shield } from "lucide-react";
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
  const { verifyPin, changePin, planningSessionMinutes, updateSessionMinutes } = useSettings(userId);
  const { roles, addRole, updateRole, deleteRole } = useCustomRoles(userId);
  const { logs: auditLogs, loading: auditLoading, hasMore, loadMore, log: auditLog, exportCSV } = useAuditLog(userId);

  const [settingsUnlocked, setSettingsUnlocked] = useState(false);
  const [settingsPin, setSettingsPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [currentManagerId, setCurrentManagerId] = useState<string | null>(null);
  const [newPin, setNewPin] = useState("");
  const [newEmp, setNewEmp] = useState("");
  const [showRegistre, setShowRegistre] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [newRoleLabel, setNewRoleLabel] = useState("");
  const [newRoleColor, setNewRoleColor] = useState("#2563eb");
  const [editRoleId, setEditRoleId] = useState<string | null>(null);
  const [editRoleLabel, setEditRoleLabel] = useState("");
  const [editRoleColor, setEditRoleColor] = useState("");
  const [empPinEdit, setEmpPinEdit] = useState<string | null>(null);
  const [empPinValue, setEmpPinValue] = useState("");
  const [auditFilter, setAuditFilter] = useState("all");

  // Export comptable state
  const [exportMonth, setExportMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [exporting, setExporting] = useState(false);

  function tryUnlock() {
    // Try employee PINs (managers only)
    const manager = employees.find(emp => emp.is_manager && emp.pin_hash && verifyEmployeePin(emp, settingsPin));
    if (manager) {
      setSettingsUnlocked(true);
      setCurrentManagerId(manager.id);
      setSettingsPin("");
      setPinError(false);
      auditLog("settings_unlocked", `Paramètres déverrouillés par ${manager.name}`, manager.id, manager.name);
      return;
    }
    // Fallback: legacy manager PIN
    if (verifyPin(settingsPin)) {
      setSettingsUnlocked(true);
      setCurrentManagerId(null);
      setSettingsPin("");
      setPinError(false);
      auditLog("settings_unlocked", "Paramètres déverrouillés (code manager legacy)");
      return;
    }
    setPinError(true);
    setSettingsPin("");
    setTimeout(() => setPinError(false), 1500);
  }

  const mealTypeLabel = (type: string | null) => {
    if (type === "avantage_nature") return "Avantage en nature";
    if (type === "repas_entreprise") return "Repas en entreprise";
    return "—";
  };

  const currentManagerName = currentManagerId
    ? employees.find(e => e.id === currentManagerId)?.name ?? "Manager"
    : "Manager";

  async function handleAddEmployee() {
    if (!newEmp.trim()) return;
    await addEmployee(newEmp.trim());
    await auditLog("employee_added", `Ajout employé "${newEmp.trim()}"`, currentManagerId, currentManagerName);
    setNewEmp("");
  }

  async function handleDeleteEmployee(emp: { id: string; name: string }) {
    await deleteEmployee(emp.id);
    await auditLog("employee_deleted", `Suppression employé "${emp.name}"`, currentManagerId, currentManagerName);
  }

  async function handleUpdateEmployee(empId: string, empName: string, updates: Record<string, unknown>, fieldLabel: string) {
    await updateEmployee(empId, updates as Parameters<typeof updateEmployee>[1]);
    await auditLog("employee_updated", `Modification ${fieldLabel} de "${empName}"`, currentManagerId, currentManagerName);
  }

  async function handleSetPin(empId: string, empName: string) {
    if (empPinValue.length !== 4) return;
    await updateEmployee(empId, { pin_hash: hashEmployeePin(empPinValue) });
    await auditLog("employee_pin_changed", `PIN modifié pour "${empName}"`, currentManagerId, currentManagerName);
    setEmpPinEdit(null);
    setEmpPinValue("");
  }

  async function handleToggleManager(emp: { id: string; name: string; is_manager: boolean }) {
    await updateEmployee(emp.id, { is_manager: !emp.is_manager });
    await auditLog("employee_role_changed", `${emp.name} ${!emp.is_manager ? "promu manager" : "retiré du rôle manager"}`, currentManagerId, currentManagerName);
  }

  async function handleAddRole() {
    if (!newRoleLabel.trim()) return;
    await addRole(newRoleLabel.trim(), newRoleColor);
    await auditLog("role_added", `Ajout rôle "${newRoleLabel.trim()}"`, currentManagerId, currentManagerName);
    setNewRoleLabel("");
  }

  async function handleUpdateRole(roleId: string) {
    await updateRole(roleId, { label: editRoleLabel, color: editRoleColor });
    await auditLog("role_updated", `Modification rôle "${editRoleLabel}"`, currentManagerId, currentManagerName);
    setEditRoleId(null);
  }

  async function handleDeleteRole(r: { id: string; label: string }) {
    await deleteRole(r.id);
    await auditLog("role_deleted", `Suppression rôle "${r.label}"`, currentManagerId, currentManagerName);
  }

  async function exportComptable() {
    if (exporting) return;
    setExporting(true);
    try {
      const [year, month] = exportMonth.split("-").map(Number);
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0);

      const { data: allSlots } = await supabase
        .from("planning_slots")
        .select("employee_id, day_index, start_time, end_time, role, week_key")
        .eq("user_id", userId);

      if (!allSlots) { setExporting(false); return; }

      const monthSlots = allSlots.filter(s => {
        const [wkYear, wkNum] = s.week_key.split("-W").map(Number);
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

      const head = [["Employé", "Heures contrat", "Heures travaillées", "Nb jours travaillés", "Type repas", "Nb repas"]];
      const body = employees.map((emp) => {
        const empSlots = monthSlots.filter(s => s.employee_id === emp.id);
        let totalMinutes = 0;
        const workedDays = new Set<string>();
        empSlots.forEach(s => {
          totalMinutes += calcSlotMinutes(s.start_time, s.end_time);
          workedDays.add(`${s.week_key}-${s.day_index}`);
        });
        const totalHours = (totalMinutes / 60).toFixed(1);
        return [
          emp.name,
          emp.contract_hours ? `${emp.contract_hours}h/sem` : "—",
          `${totalHours}h`,
          String(workedDays.size),
          mealTypeLabel(emp.meal_type),
          String(workedDays.size),
        ];
      });

      autoTable(doc, {
        head, body, startY: 28, theme: "grid",
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [17, 17, 17], textColor: 255, fontStyle: "bold", fontSize: 9, halign: "center" as const },
        columnStyles: { 0: { fontStyle: "bold" } },
        alternateRowStyles: { fillColor: [248, 248, 248] },
      });

      employees.forEach((emp) => {
        const empSlots = monthSlots.filter(s => s.employee_id === emp.id);
        if (empSlots.length === 0) return;
        doc.addPage();
        doc.setFontSize(12);
        doc.text(`Détail — ${emp.name} — ${monthNames[month - 1]} ${year}`, 14, 18);
        if (emp.meal_type) {
          doc.setFontSize(9);
          doc.text(`Type repas : ${mealTypeLabel(emp.meal_type)}`, 14, 25);
        }
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
          return [`${dayName} ${dateStr.slice(8)}/${dateStr.slice(5, 7)}`, horaires, `${(mins / 60).toFixed(1)}h`, "1"];
        });
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
      await auditLog("export_comptable", `Export comptable ${monthNames[month - 1]} ${year}`, currentManagerId, currentManagerName);
    } finally {
      setExporting(false);
    }
  }

  const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
    badgeuse: { label: "Badgeuse", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
    dlc: { label: "DLC", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
    haccp: { label: "HACCP", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
    planning: { label: "Planning", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
    parametres: { label: "Paramètres", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
    memos: { label: "Notes", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300" },
    general: { label: "Général", color: "bg-muted text-muted-foreground" },
  };

  const categories = [...new Set(auditLogs.map(l => l.category))];
  const filteredLogs = auditFilter === "all"
    ? auditLogs
    : auditLogs.filter(l => l.category === auditFilter);

  if (!settingsUnlocked) {
    const managers = employees.filter(e => e.is_manager && e.pin_hash);
    return (
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Lock className="h-4 w-4" /> Code manager requis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {managers.length > 0 && (
            <p className="text-xs text-muted-foreground">Entrez votre code PIN personnel (managers uniquement).</p>
          )}
          <div className="flex gap-2">
            <Input type="password" maxLength={4} value={settingsPin} onChange={e => setSettingsPin(e.target.value)} onKeyDown={e => e.key === "Enter" && tryUnlock()} placeholder="••••" className={`text-center text-lg tracking-[6px] ${pinError ? "border-destructive" : ""}`} />
            <Button onClick={tryUnlock}>Accéder</Button>
          </div>
          {pinError && <p className="text-xs text-destructive mt-2">Code incorrect ou pas manager</p>}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 max-w-xl">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Shield className="h-4 w-4" /> Connecté en tant que <strong>{currentManagerName}</strong>
      </div>

      {/* PIN manager legacy */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Code manager (legacy)</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input type="password" maxLength={4} value={newPin} onChange={e => setNewPin(e.target.value)} placeholder="Nouveau code (4 chiffres)" />
            <Button variant="outline" onClick={async () => {
              if (newPin.length === 4) {
                await changePin(newPin);
                await auditLog("manager_pin_changed", "Code manager legacy modifié", currentManagerId, currentManagerName);
                setNewPin("");
              }
            }}>Enregistrer</Button>
          </div>
        </CardContent>
      </Card>

      {/* Employés */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> Employés</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {employees.map((emp) => (
            <div key={emp.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg flex-wrap">
              <span className="flex-1 text-sm font-medium min-w-[80px]">
                {emp.name}
                {emp.is_manager && <Badge variant="outline" className="ml-1.5 text-[10px] border-primary text-primary">Manager</Badge>}
              </span>
              <Input type="number" min={0} max={48} value={emp.contract_hours ?? ""} onChange={e => handleUpdateEmployee(emp.id, emp.name, { contract_hours: e.target.value ? parseFloat(e.target.value) : null }, "heures contrat")} placeholder="h/sem" className="w-16 h-8 text-center text-xs" />
              <span className="text-xs text-muted-foreground">h/sem</span>
              <Select value={emp.meal_type || "none"} onValueChange={v => handleUpdateEmployee(emp.id, emp.name, { meal_type: v === "none" ? null : v }, "type repas")}>
                <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="Type repas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  <SelectItem value="avantage_nature">Avantage en nature</SelectItem>
                  <SelectItem value="repas_entreprise">Repas en entreprise</SelectItem>
                </SelectContent>
              </Select>
              <Input value={emp.nfc_badge_id || ""} onChange={e => handleUpdateEmployee(emp.id, emp.name, { nfc_badge_id: e.target.value || null }, "badge NFC")} placeholder="ID badge NFC" className="w-[120px] h-8 text-xs font-mono" />

              {/* PIN */}
              {empPinEdit === emp.id ? (
                <div className="flex gap-1 items-center">
                  <Input type="password" maxLength={4} value={empPinValue} onChange={e => setEmpPinValue(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSetPin(emp.id, emp.name)} placeholder="PIN" className="w-16 h-8 text-center text-xs" />
                  <Button size="icon" className="h-7 w-7" onClick={() => handleSetPin(emp.id, emp.name)}><Check className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEmpPinEdit(null); setEmpPinValue(""); }}><X className="h-3 w-3" /></Button>
                </div>
              ) : (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setEmpPinEdit(emp.id); setEmpPinValue(""); }}>
                  {emp.pin_hash ? "🔑 Changer PIN" : "🔑 Définir PIN"}
                </Button>
              )}

              {/* Manager toggle */}
              <div className="flex items-center gap-1">
                <Switch checked={emp.is_manager} onCheckedChange={() => handleToggleManager(emp)} className="scale-75" />
                <span className="text-[10px] text-muted-foreground">Mgr</span>
              </div>

              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteEmployee(emp)}><Trash2 className="h-3 w-3" /></Button>
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <Input value={newEmp} onChange={e => setNewEmp(e.target.value)} onKeyDown={async e => { if (e.key === "Enter") await handleAddEmployee(); }} placeholder="Prénom du nouvel employé" className="flex-1" />
            <Button onClick={handleAddEmployee}><Plus className="h-4 w-4" /></Button>
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
                      <TableHead className="text-center">Rôle</TableHead>
                      <TableHead className="text-center">Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((emp, i) => (
                      <TableRow key={emp.id}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{emp.name}</TableCell>
                        <TableCell className="text-center">{emp.contract_hours ? `${emp.contract_hours}h/sem` : "—"}</TableCell>
                        <TableCell className="text-center text-xs">{mealTypeLabel(emp.meal_type)}</TableCell>
                        <TableCell className="text-center">
                          {emp.is_manager ? <Badge variant="outline" className="border-primary text-primary text-[10px]">Manager</Badge> : <span className="text-xs text-muted-foreground">Employé</span>}
                        </TableCell>
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
          {roles.map((r) => (
            <div key={r.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
              {editRoleId === r.id ? (
                <>
                  <Input value={editRoleLabel} onChange={e => setEditRoleLabel(e.target.value)} className="flex-1 h-8" />
                  <input type="color" value={editRoleColor} onChange={e => setEditRoleColor(e.target.value)} className="w-8 h-7 border-none rounded cursor-pointer p-0" />
                  <Button size="icon" className="h-8 w-8" onClick={() => handleUpdateRole(r.id)}><Check className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditRoleId(null)}><X className="h-3 w-3" /></Button>
                </>
              ) : (
                <>
                  <div className="w-4 h-4 rounded shrink-0" style={{ background: r.color }} />
                  <span className="flex-1 text-sm">{r.label}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditRoleId(r.id); setEditRoleLabel(r.label); setEditRoleColor(r.color); }}><Pencil className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteRole(r)}><Trash2 className="h-3 w-3" /></Button>
                </>
              )}
            </div>
          ))}
          {roles.length === 0 && <p className="text-sm text-muted-foreground p-2">Aucun rôle configuré</p>}
          <div className="flex gap-2 pt-2">
            <Input value={newRoleLabel} onChange={e => setNewRoleLabel(e.target.value)} onKeyDown={async e => { if (e.key === "Enter") await handleAddRole(); }} placeholder="Nom du rôle" className="flex-1" />
            <input type="color" value={newRoleColor} onChange={e => setNewRoleColor(e.target.value)} className="w-9 h-10 border-none rounded cursor-pointer p-0" />
            <Button onClick={handleAddRole}><Plus className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      {/* Durée session identification */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">⏱️ Durée de session d'identification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Après identification (PIN ou badge), les modules restent déverrouillés pendant cette durée avant de redemander le code.
          </p>
          <div className="flex gap-2 items-center">
            <Input type="number" min={1} max={60} value={planningSessionMinutes} onChange={async e => {
              const v = parseInt(e.target.value);
              if (v >= 1 && v <= 60) {
                await updateSessionMinutes(v);
                await auditLog("session_duration_changed", `Durée session modifiée : ${v} min`, currentManagerId, currentManagerName);
              }
            }} className="w-20 h-9 text-center" />
            <span className="text-sm text-muted-foreground">minutes</span>
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
            Exporte un PDF mensuel avec les horaires de chaque employé, le total d'heures et le nombre de repas.
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

      {/* Journal d'activité */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2"><ScrollText className="h-4 w-4" /> Historique des activités</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="text-xs" onClick={exportCSV}>
                <Download className="h-3 w-3 mr-1" />Exporter CSV
              </Button>
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowAuditLog(v => !v)}>
                {showAuditLog ? <><EyeOff className="h-3 w-3 mr-1" />Masquer</> : <><Eye className="h-3 w-3 mr-1" />Afficher</>}
              </Button>
            </div>
          </div>
        </CardHeader>
        <Collapsible open={showAuditLog} onOpenChange={setShowAuditLog}>
          <CollapsibleContent>
            <CardContent className="space-y-3">
              {categories.length > 1 && (
                <Select value={auditFilter} onValueChange={setAuditFilter}>
                  <SelectTrigger className="w-[220px] h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les catégories</SelectItem>
                    {categories.map(c => {
                      const cat = CATEGORY_LABELS[c];
                      return <SelectItem key={c} value={c}>{cat?.label ?? c}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              )}
              {auditLoading ? (
                <p className="text-sm text-muted-foreground">Chargement…</p>
              ) : filteredLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune activité enregistrée.</p>
              ) : (
                <div className="space-y-1 max-h-[500px] overflow-y-auto">
                  {filteredLogs.map(entry => {
                    const catInfo = CATEGORY_LABELS[entry.category] ?? CATEGORY_LABELS.general;
                    return (
                      <div key={entry.id} className="flex items-start gap-2 p-2 rounded text-xs bg-muted/30 hover:bg-muted/50">
                        <span className="text-muted-foreground whitespace-nowrap shrink-0">
                          {new Date(entry.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}{" "}
                          {new Date(entry.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <Badge variant="secondary" className={`text-[10px] shrink-0 ${catInfo.color}`}>
                          {catInfo.label}
                        </Badge>
                        <span className="flex-1">{entry.description}</span>
                        {entry.employee_name && (
                          <Badge variant="outline" className="text-[10px] shrink-0">{entry.employee_name}</Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {hasMore && !auditLoading && (
                <Button variant="ghost" size="sm" className="w-full text-xs" onClick={loadMore}>Charger plus…</Button>
              )}
              <p className="text-xs text-muted-foreground italic">📌 Les logs sont conservés 90 jours (nettoyage automatique).</p>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
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
