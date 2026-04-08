import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useProducts } from "@/hooks/useProducts";
import { useEmployees } from "@/hooks/useEmployees";
import { useTemperatureLogs } from "@/hooks/useTemperatureLogs";
import { useCleaningPlan } from "@/hooks/useCleaningPlan";
import { useEquipments } from "@/hooks/useEquipments";
import { useTimeEntries } from "@/hooks/useTimeEntries";
import { useMemos } from "@/hooks/useMemos";
import { statusOf, todayStr, diffH, fmtDuration, isTempAlert } from "@/lib/constants";
import { CardSkeleton } from "@/components/ui/loading-skeletons";
import { ErrorAlert } from "@/components/ui/error-alert";
import {
  ClipboardCheck,
  Thermometer,
  SprayCan,
  Users,
  AlertTriangle,
  Clock,
  StickyNote,
} from "lucide-react";

interface DashboardProps {
  userId: string;
}

export default function Dashboard({ userId }: DashboardProps) {
  const { produits, loading: prodLoading, error: prodError, retry: prodRetry } = useProducts(userId);
  const { employees, loading: empLoading } = useEmployees(userId);
  const { logs: tempLogs, loading: tempLoading } = useTemperatureLogs(userId);
  const { tasks: cleaningTasks, logs: cleaningLogs, loading: cleanLoading } = useCleaningPlan(userId);
  const { equipments, loading: equipLoading } = useEquipments(userId);
  const { entries, loading: entriesLoading } = useTimeEntries(userId);
  const { memos, loading: memosLoading } = useMemos(userId);

  const today = todayStr();
  const loading = prodLoading || empLoading || tempLoading || cleanLoading || equipLoading || entriesLoading || memosLoading;

  const dlcStats = useMemo(() => {
    let expired = 0, urgent = 0, ok = 0;
    produits.forEach(p => {
      const s = statusOf(p.dlc);
      if (s === "expire") expired++;
      else if (s === "urgent") urgent++;
      else ok++;
    });
    return { expired, urgent, ok, total: produits.length };
  }, [produits]);

  const cleaningStats = useMemo(() => {
    const done = cleaningTasks.filter(t =>
      cleaningLogs.some(l => l.task_id === t.id && l.done_date === today)
    ).length;
    return { done, total: cleaningTasks.length };
  }, [cleaningTasks, cleaningLogs, today]);

  const tempStats = useMemo(() => {
    const todayLogs = tempLogs.filter(l => l.log_date === today);
    const alerts = todayLogs.filter(l => {
      const eq = equipments.find(e => e.name === l.equipment_name);
      return eq ? isTempAlert(l.temperature, eq.equipment_type) : false;
    });
    return { recorded: todayLogs.length, alerts: alerts.length, expected: equipments.length * 2 };
  }, [tempLogs, equipments, today]);

  const staffToday = useMemo(() => {
    const todayEntries = entries.filter(e => e.work_date === today);
    const activeNow = todayEntries.filter(e => e.arrival_ts && !e.departure_ts).length;
    let totalHours = 0;
    todayEntries.forEach(e => {
      if (e.arrival_ts && e.departure_ts) totalHours += diffH(e.arrival_ts, e.departure_ts);
      else if (e.arrival_ts) totalHours += diffH(e.arrival_ts, Date.now());
    });
    return { activeNow, totalHours, totalEmployees: employees.length };
  }, [entries, employees, today]);

  if (prodError) return <ErrorAlert message={prodError} onRetry={prodRetry} />;
  if (loading) return <CardSkeleton count={4} />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Tableau de bord</h2>
        <p className="text-muted-foreground">
          Vue d'ensemble — {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Produits DLC</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dlcStats.total}</div>
            <div className="flex gap-2 mt-1">
              {dlcStats.expired > 0 && <Badge variant="destructive">{dlcStats.expired} expiré{dlcStats.expired > 1 ? "s" : ""}</Badge>}
              {dlcStats.urgent > 0 && <Badge variant="outline" className="border-yellow-500 text-yellow-600">{dlcStats.urgent} urgent{dlcStats.urgent > 1 ? "s" : ""}</Badge>}
              {dlcStats.ok > 0 && <Badge variant="outline" className="border-green-500 text-green-600">{dlcStats.ok} OK</Badge>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Températures</CardTitle>
            <Thermometer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tempStats.recorded}/{tempStats.expected}</div>
            <p className="text-xs text-muted-foreground">relevés aujourd'hui</p>
            {tempStats.alerts > 0 && (
              <Badge variant="destructive" className="mt-1">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {tempStats.alerts} alerte{tempStats.alerts > 1 ? "s" : ""}
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Nettoyage</CardTitle>
            <SprayCan className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cleaningStats.done}/{cleaningStats.total}</div>
            <p className="text-xs text-muted-foreground">tâches complétées</p>
            {cleaningStats.total > 0 && (
              <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${(cleaningStats.done / cleaningStats.total) * 100}%` }}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Équipe</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{staffToday.activeNow}/{staffToday.totalEmployees}</div>
            <p className="text-xs text-muted-foreground">en service actuellement</p>
            {staffToday.totalHours > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                <Clock className="h-3 w-3 inline mr-1" />
                {fmtDuration(staffToday.totalHours)} cumulées
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Notes partagées */}
      {memos.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <StickyNote className="h-5 w-5 text-muted-foreground" />
              Notes partagées
              <Badge variant="secondary" className="ml-auto">{memos.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {memos.slice(0, 5).map(m => (
                <li key={m.id} className="text-sm flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  <span className="line-clamp-2">{m.content}</span>
                </li>
              ))}
              {memos.length > 5 && (
                <li className="text-xs text-muted-foreground">+ {memos.length - 5} autre{memos.length - 5 > 1 ? "s" : ""}</li>
              )}
            </ul>
          </CardContent>
        </Card>
      )}

      {(dlcStats.expired > 0 || dlcStats.urgent > 0 || tempStats.alerts > 0) && (
        <Card className="border-destructive/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Alertes actives
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {dlcStats.expired > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="destructive">DLC</Badge>
                <span>{dlcStats.expired} produit{dlcStats.expired > 1 ? "s" : ""} expiré{dlcStats.expired > 1 ? "s" : ""} — action requise</span>
              </div>
            )}
            {dlcStats.urgent > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline" className="border-yellow-500 text-yellow-600">DLC</Badge>
                <span>{dlcStats.urgent} produit{dlcStats.urgent > 1 ? "s" : ""} à consommer demain</span>
              </div>
            )}
            {tempStats.alerts > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="destructive">Temp.</Badge>
                <span>{tempStats.alerts} relevé{tempStats.alerts > 1 ? "s" : ""} hors normes</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
