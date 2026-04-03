import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SprayCan, CheckCircle2 } from "lucide-react";
import { todayStr, fmtDate, FREQUENCIES } from "@/lib/constants";

interface NettoyageModuleProps {
  userId: string;
  cleaningTasks: any[];
  cleaningLogs: any[];
  logCleaningDone: (taskId: string, doneBy: string) => Promise<void>;
  deleteCleaningLog: (id: string) => Promise<void>;
}

export default function NettoyageModule({ userId, cleaningTasks: tasks, cleaningLogs: logs, logCleaningDone: logDone }: NettoyageModuleProps) {
  const [doneBy, setDoneBy] = useState("");
  const [filterFreq, setFilterFreq] = useState("tous");
  const today = todayStr();

  const isTaskDoneToday = (taskId: string) => logs.some((l: any) => l.task_id === taskId && l.done_date === today);
  const lastDone = (taskId: string) => logs.find((l: any) => l.task_id === taskId);

  const filteredTasks = useMemo(() => {
    if (filterFreq === "tous") return tasks;
    return tasks.filter((t: any) => t.frequency === filterFreq);
  }, [tasks, filterFreq]);

  const filteredZones = useMemo(() => {
    const z: Record<string, any[]> = {};
    filteredTasks.forEach((t: any) => { if (!z[t.zone]) z[t.zone] = []; z[t.zone].push(t); });
    return z;
  }, [filteredTasks]);

  const doneToday = tasks.filter((t: any) => isTaskDoneToday(t.id)).length;

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

      <div>
        <Input value={doneBy} onChange={e => setDoneBy(e.target.value)} placeholder="Votre prénom (pour valider)" className="max-w-xs" />
      </div>

      {Object.keys(filteredZones).length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          Aucune tâche — allez dans Paramètres HACCP pour en ajouter.
        </CardContent></Card>
      ) : (
        Object.entries(filteredZones).map(([zone, zoneTasks]) => (
          <div key={zone} className="space-y-1">
            <h3 className="text-sm font-semibold text-muted-foreground border-b pb-1">{zone}</h3>
            {zoneTasks.map((task: any) => {
              const done = isTaskDoneToday(task.id);
              const last = lastDone(task.id);
              const freq = FREQUENCIES.find(f => f.value === task.frequency);
              return (
                <div key={task.id} className={`flex items-center gap-3 p-2.5 rounded-lg ${done ? "bg-green-50 dark:bg-green-950/20" : "bg-muted/50"}`}>
                  <Button
                    variant={done ? "default" : "outline"}
                    size="icon"
                    className={`h-7 w-7 shrink-0 ${done ? "bg-green-600 hover:bg-green-700" : ""}`}
                    disabled={done || !doneBy.trim()}
                    onClick={() => !done && logDone(task.id, doneBy.trim())}
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
    </div>
  );
}
