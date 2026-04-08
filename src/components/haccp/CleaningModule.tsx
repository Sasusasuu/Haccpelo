import { useState, useMemo, useCallback } from "react";
import { useEmployees } from "@/hooks/useEmployees";
import { useSettings } from "@/hooks/useSettings";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useIdentitySession } from "@/hooks/useIdentitySession";
import IdentifyModal from "@/components/equipe/IdentifyModal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SprayCan, CheckCircle2, Shield } from "lucide-react";
import { todayStr, fmtDate, FREQUENCIES } from "@/lib/constants";
import { ErrorAlert } from "@/components/ui/error-alert";
import { ListSkeleton } from "@/components/ui/loading-skeletons";

interface CleaningModuleProps {
  userId: string;
  cleaningTasks: { id: string; zone: string; task_name: string; frequency: string }[];
  cleaningLogs: { id: string; task_id: string; done_date: string; done_by: string }[];
  logCleaningDone: (taskId: string, doneBy: string) => Promise<void>;
  deleteCleaningLog: (id: string) => Promise<void>;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export default function CleaningModule({ userId, cleaningTasks: tasks, cleaningLogs: logs, logCleaningDone: logDone, loading, error, onRetry }: CleaningModuleProps) {
  const { employees } = useEmployees(userId);
  const { planningSessionMinutes } = useSettings(userId);
  const { log: auditLog } = useAuditLog(userId);
  const { identifiedEmployee, isIdentified, startSession, clearSession } = useIdentitySession(planningSessionMinutes);

  const [filterFreq, setFilterFreq] = useState("tous");
  const [showIdentify, setShowIdentify] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const today = todayStr();

  const requireAuth = useCallback((action: () => void) => {
    if (isIdentified) { action(); } else { setPendingAction(() => action); setShowIdentify(true); }
  }, [isIdentified]);

  const handleIdentified = useCallback((emp: import("@/hooks/useEmployees").Employee) => {
    startSession(emp);
    setShowIdentify(false);
    if (pendingAction) { pendingAction(); setPendingAction(null); }
  }, [startSession, pendingAction]);

  const isTaskDoneToday = (taskId: string) => logs.some(l => l.task_id === taskId && l.done_date === today);
  const lastDone = (taskId: string) => logs.find(l => l.task_id === taskId);

  const filteredTasks = useMemo(() => {
    if (filterFreq === "tous") return tasks;
    return tasks.filter(t => t.frequency === filterFreq);
  }, [tasks, filterFreq]);

  const filteredZones = useMemo(() => {
    const z: Record<string, typeof tasks> = {};
    filteredTasks.forEach(t => { if (!z[t.zone]) z[t.zone] = []; z[t.zone].push(t); });
    return z;
  }, [filteredTasks]);

  const doneToday = tasks.filter(t => isTaskDoneToday(t.id)).length;

  const handleValidate = (task: { id: string; task_name: string; zone: string }) => {
    requireAuth(async () => {
      const empName = identifiedEmployee?.name ?? "Inconnu";
      await logDone(task.id, empName);
      await auditLog("cleaning_done", `Nettoyage "${task.task_name}" (${task.zone}) validé par ${empName}`, identifiedEmployee?.id ?? null, identifiedEmployee?.name ?? null);
    });
  };

  if (error) return <ErrorAlert message={error} onRetry={onRetry} />;
  if (loading) return <ListSkeleton rows={5} />;

  return (
    <div className="space-y-4">
      {isIdentified && identifiedEmployee && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Shield className="h-3.5 w-3.5 text-primary" />
          Identifié : <strong>{identifiedEmployee.name}</strong>
          <Button variant="ghost" size="sm" className="h-5 text-[10px] ml-auto" onClick={clearSession}>Verrouiller</Button>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <SprayCan className="h-5 w-5" /> Plan de nettoyage
          </h2>
          {tasks.length > 0 && (
            <Badge variant={doneToday === tasks.length ? "default" : "outline"}>
              {doneToday}/{tasks.length} aujourd'hui
            </Badge>
          )}
        </div>
      </div>

      <Tabs value={filterFreq} onValueChange={setFilterFreq}>
        <TabsList>
          <TabsTrigger value="tous">Tous</TabsTrigger>
          {FREQUENCIES.map(f => <TabsTrigger key={f.value} value={f.value}>{f.emoji} {f.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      {Object.keys(filteredZones).length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          Aucune tâche — allez dans Paramètres HACCP pour en ajouter.
        </CardContent></Card>
      ) : (
        Object.entries(filteredZones).map(([zone, zoneTasks]) => (
          <div key={zone} className="space-y-1">
            <h3 className="text-sm font-semibold text-muted-foreground border-b pb-1">{zone}</h3>
            {zoneTasks.map((task) => {
              const done = isTaskDoneToday(task.id);
              const last = lastDone(task.id);
              const freq = FREQUENCIES.find(f => f.value === task.frequency);
              return (
                <div key={task.id} className={`flex items-center gap-3 p-2.5 rounded-lg ${done ? "bg-green-50 dark:bg-green-950/20" : "bg-muted/50"}`}>
                  <Button
                    variant={done ? "default" : "outline"}
                    size="icon"
                    className={`h-7 w-7 shrink-0 ${done ? "bg-green-600 hover:bg-green-700" : ""}`}
                    disabled={done}
                    onClick={() => !done && handleValidate(task)}
                  >
                    {done && <CheckCircle2 className="h-4 w-4" />}
                  </Button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${done ? "line-through text-green-600 dark:text-green-400" : ""}`}>{task.task_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {freq?.emoji} {freq?.label}
                      {done && last && <span className="ml-2 text-green-600">✓ {last.done_by}</span>}
                      {!done && last && <span className="ml-2">Dernier : {fmtDate(last.done_date)} par {last.done_by}</span>}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ))
      )}

      <IdentifyModal
        open={showIdentify}
        onClose={() => { setShowIdentify(false); setPendingAction(null); }}
        employees={employees}
        onIdentified={handleIdentified}
        title="Identification requise"
        subtitle="Entrez votre code pour valider le nettoyage."
      />
    </div>
  );
}
