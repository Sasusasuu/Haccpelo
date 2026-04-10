import { useState, useMemo, lazy, Suspense } from "react";
import { useSettings } from "@/hooks/useSettings";
import { CleaningTask } from "@/hooks/useCleaningPlan";
import { Equipment } from "@/hooks/useEquipments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lock, Plus, Pencil, Trash2, X, Check } from "lucide-react";

const ProductCatalogSection = lazy(() => import("./ProductCatalogSection"));

interface HACCPParametresProps {
  userId: string;
  equipmentsList: Equipment[];
  addEquipment: (name: string, type: "frigo" | "congelateur") => Promise<void>;
  updateEquipment: (id: string, name: string, type: "frigo" | "congelateur") => Promise<void>;
  deleteEquipment: (id: string) => Promise<void>;
  cleaningTasks: CleaningTask[];
  addCleaningTask: (task: Omit<CleaningTask, "id">) => Promise<void>;
  deleteCleaningTask: (id: string) => Promise<void>;
}

export default function HACCPParametres({ userId, equipmentsList, addEquipment, updateEquipment, deleteEquipment, cleaningTasks, addCleaningTask, deleteCleaningTask }: HACCPParametresProps) {
  const { verifyPin } = useSettings(userId);
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [newEquipName, setNewEquipName] = useState("");
  const [newEquipType, setNewEquipType] = useState<"frigo" | "congelateur">("frigo");
  const [editEquipId, setEditEquipId] = useState<string | null>(null);
  const [editEquipName, setEditEquipName] = useState("");
  const [editEquipType, setEditEquipType] = useState<"frigo" | "congelateur">("frigo");
  const [newTaskZone, setNewTaskZone] = useState("");
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskFreq, setNewTaskFreq] = useState<"quotidien" | "hebdomadaire" | "mensuel">("quotidien");

  async function tryUnlock() {
    const ok = await verifyPin(pin);
    if (ok) { setUnlocked(true); setPin(""); setPinError(false); }
    else { setPinError(true); setPin(""); setTimeout(() => setPinError(false), 1500); }
  }

  const cleaningZones = useMemo(() => {
    const z: Record<string, CleaningTask[]> = {};
    cleaningTasks.forEach((t) => { if (!z[t.zone]) z[t.zone] = []; z[t.zone].push(t); });
    return z;
  }, [cleaningTasks]);

  if (!unlocked) {
    return (
      <Card className="max-w-md">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Lock className="h-4 w-4" /> Code manager requis</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input type="password" maxLength={4} value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === "Enter" && tryUnlock()} placeholder="••••" className={`text-center text-lg tracking-[6px] ${pinError ? "border-destructive" : ""}`} />
            <Button onClick={tryUnlock}>Accéder</Button>
          </div>
          {pinError && <p className="text-xs text-destructive mt-2">Code incorrect</p>}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 max-w-xl">
      {/* Équipements */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">🌡️ Équipements (frigos / congélateurs)</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {equipmentsList.map((eq: any) => (
            <div key={eq.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
              {editEquipId === eq.id ? (
                <>
                  <Input value={editEquipName} onChange={e => setEditEquipName(e.target.value)} className="flex-1 h-8" />
                  <Select value={editEquipType} onValueChange={setEditEquipType}>
                    <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="frigo">🧊 Frigo</SelectItem>
                      <SelectItem value="congelateur">❄️ Congélateur</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="icon" className="h-8 w-8" onClick={async () => { await updateEquipment(eq.id, editEquipName, editEquipType); setEditEquipId(null); }}><Check className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditEquipId(null)}><X className="h-3 w-3" /></Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm">{eq.equipment_type === "congelateur" ? "❄️" : "🧊"} {eq.name}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditEquipId(eq.id); setEditEquipName(eq.name); setEditEquipType(eq.equipment_type); }}><Pencil className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteEquipment(eq.id)}><Trash2 className="h-3 w-3" /></Button>
                </>
              )}
            </div>
          ))}
          {equipmentsList.length === 0 && <p className="text-sm text-muted-foreground p-2">Aucun équipement configuré</p>}
          <div className="flex gap-2 pt-2">
            <Input value={newEquipName} onChange={e => setNewEquipName(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && newEquipName.trim()) { addEquipment(newEquipName.trim(), newEquipType); setNewEquipName(""); } }} placeholder="Nom (ex: Frigo cuisine)" className="flex-1" />
            <Select value={newEquipType} onValueChange={setNewEquipType}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="frigo">🧊 Frigo</SelectItem>
                <SelectItem value="congelateur">❄️ Congélateur</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={async () => { if (newEquipName.trim()) { await addEquipment(newEquipName.trim(), newEquipType); setNewEquipName(""); } }}><Plus className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      {/* Plan de nettoyage */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">🧹 Plan de nettoyage</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {Object.entries(cleaningZones).map(([zone, tasks]) => (
            <div key={zone}>
              <p className="text-xs font-semibold text-muted-foreground mb-1">{zone}</p>
              {tasks.map((task: any) => (
                <div key={task.id} className="flex items-center gap-2 p-1.5 bg-muted/50 rounded mb-1">
                  <span className="flex-1 text-sm">{task.task_name}</span>
                  <span className="text-xs text-muted-foreground">{task.frequency === "quotidien" ? "🔄" : task.frequency === "hebdomadaire" ? "📅" : "🗓"}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteCleaningTask(task.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              ))}
            </div>
          ))}
          {cleaningTasks.length === 0 && <p className="text-sm text-muted-foreground p-2">Aucune tâche</p>}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Input value={newTaskZone} onChange={e => setNewTaskZone(e.target.value)} placeholder="Zone (ex: Cuisine)" />
            <Input value={newTaskName} onChange={e => setNewTaskName(e.target.value)} placeholder="Tâche (ex: Nettoyer sols)" />
          </div>
          <div className="flex gap-2">
            <Select value={newTaskFreq} onValueChange={setNewTaskFreq}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="quotidien">Quotidien</SelectItem>
                <SelectItem value="hebdomadaire">Hebdomadaire</SelectItem>
                <SelectItem value="mensuel">Mensuel</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={async () => { if (newTaskZone.trim() && newTaskName.trim()) { await addCleaningTask({ zone: newTaskZone.trim(), task_name: newTaskName.trim(), frequency: newTaskFreq }); setNewTaskZone(""); setNewTaskName(""); } }}>
              <Plus className="h-4 w-4 mr-1" />Ajouter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Catalogue produits */}
      <Suspense fallback={<p className="text-sm text-muted-foreground p-2">Chargement...</p>}>
        <ProductCatalogSection userId={userId} />
      </Suspense>

      <Button variant="outline" onClick={() => setUnlocked(false)}>
        <Lock className="h-4 w-4 mr-2" />Verrouiller les paramètres
      </Button>
    </div>
  );
}
