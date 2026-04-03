import { useState } from "react";
import { useEmployees } from "@/hooks/useEmployees";
import { useSettings } from "@/hooks/useSettings";
import { useCustomRoles } from "@/hooks/useCustomRoles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Lock, Plus, Pencil, Trash2, X, Check, Users, LogOut, Eye, EyeOff } from "lucide-react";
import { PRESET_COLORS } from "@/lib/constants";

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

  function tryUnlock() {
    if (verifyPin(settingsPin)) { setSettingsUnlocked(true); setSettingsPin(""); setPinError(false); }
    else { setPinError(true); setSettingsPin(""); setTimeout(() => setPinError(false), 1500); }
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
            <div key={emp.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
              <span className="flex-1 text-sm font-medium">{emp.name}</span>
              <Input type="number" min={0} max={48} value={emp.contract_hours || ""} onChange={e => updateEmployee(emp.id, { contract_hours: e.target.value ? parseFloat(e.target.value) : null })} placeholder="h/sem" className="w-16 h-8 text-center text-xs" />
              <span className="text-xs text-muted-foreground">h/sem</span>
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
                      <TableHead className="text-center">Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((emp: any, i: number) => (
                      <TableRow key={emp.id}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{emp.name}</TableCell>
                        <TableCell className="text-center">{emp.contract_hours ? `${emp.contract_hours}h/sem` : "—"}</TableCell>
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
