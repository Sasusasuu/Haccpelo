import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { SprayCan, CheckCircle2 } from "lucide-react";
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
  const [filterFreq, setFilterFreq] = useState("tous");
  const [showNameModal, setShowNameModal] = useState(false);
  const [pendingTask, setPendingTask] = useState<{ id: string; task_name: string; zone: string } | null>(null);
  const [doneByName, setDoneByName] = useState("");
  const today = todayStr();

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
    setPendingTask(task);
    setDoneByName("");
    setShowNameModal(true);
  };

  const confirmValidation = async () => {
    if (!pendingTask || !doneByName.trim()) return;
    await logDone(pendingTask.id, doneByName.trim());
    setShowNameModal(false);
    setPendingTask(null);
    setDoneByName("");
  };

  if (error) return <ErrorAlert message={error} onRetry={onRetry} />;
  if (loading) return <ListSkeleton rows={5} />;

  return (
    <div className="space-y-4">
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

      <Dialog open={showNameModal} onOpenChange={() => { setShowNameModal(false); setPendingTask(null); }}>
        <DialogContent className="max-w-sm w-[90vw]">
          <DialogHeader>
            <DialogTitle>Qui valide ?</DialogTitle>
            {pendingTask && <p className="text-sm text-muted-foreground">{pendingTask.task_name} — {pendingTask.zone}</p>}
          </DialogHeader>
          <Input
            value={doneByName}
            onChange={e => setDoneByName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && confirmValidation()}
            placeholder="Votre prénom"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowNameModal(false); setPendingTask(null); }}>Annuler</Button>
            <Button onClick={confirmValidation} disabled={!doneByName.trim()}>Valider</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
