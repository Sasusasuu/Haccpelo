import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Cell,
} from "recharts";
import { TemperatureLog } from "@/hooks/useTemperatureLogs";
import { CleaningTask, CleaningLog } from "@/hooks/useCleaningPlan";
import { isTempAlert, TEMP_THRESHOLD_FRIDGE, TEMP_THRESHOLD_FREEZER } from "@/lib/constants";
import {
  Thermometer,
  SprayCan,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

type Period = "7d" | "30d" | "90d";

interface AnalyticsChartsProps {
  tempLogs: TemperatureLog[];
  cleaningTasks: CleaningTask[];
  cleaningLogs: CleaningLog[];
  equipments: { name: string; equipment_type: string }[];
  produits: { dlc: string; nom: string; categorie: string }[];
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function dateRange(period: Period): string[] {
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const result: string[] = [];
  for (let i = days - 1; i >= 0; i--) result.push(daysAgo(i));
  return result;
}

function shortLabel(date: string, period: Period): string {
  const d = new Date(date + "T00:00:00");
  if (period === "7d") return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" });
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function fmtDateFR(date: string): string {
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

function cleanVerdict(avgRate: number) {
  if (avgRate >= 90) return { icon: CheckCircle2, text: `${avgRate}% — Excellent`, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30" };
  if (avgRate >= 60) return { icon: AlertTriangle, text: `${avgRate}% — À améliorer`, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30" };
  return { icon: XCircle, text: `${avgRate}% — Insuffisant`, color: "text-destructive", bg: "bg-destructive/10" };
}

const cleaningChartConfig: ChartConfig = {
  rate: { label: "Réalisé", color: "hsl(142 71% 45%)" },
};

function CleanTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const rate = payload[0]?.value ?? 0;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-lg">
      <p className="font-medium">{label}</p>
      <p>Réalisé : <strong className={rate >= 80 ? "text-emerald-600" : rate >= 50 ? "text-amber-600" : "text-destructive"}>{rate}%</strong></p>
    </div>
  );
}

function barColor(rate: number): string {
  if (rate >= 80) return "hsl(142 71% 45%)";
  if (rate >= 50) return "hsl(45 93% 47%)";
  return "hsl(0 72% 51%)";
}

function tempColorClass(temp: number, eqType: string): string {
  const threshold = eqType === "congelateur" ? TEMP_THRESHOLD_FREEZER : TEMP_THRESHOLD_FRIDGE;
  if (temp > threshold) return "text-destructive";
  if (temp > threshold - 1) return "text-amber-600";
  return "text-emerald-600";
}

interface EquipmentCardData {
  name: string;
  type: string;
  lastTemp: number | null;
  lastTime: string | null;
  trend: "up" | "down" | "stable" | null;
  alertCount: number;
  dailyLogs: { date: string; matin: number | null; soir: number | null; alert: boolean }[];
}

export default function AnalyticsCharts({
  tempLogs,
  cleaningTasks,
  cleaningLogs,
  equipments,
}: AnalyticsChartsProps) {
  const [period, setPeriod] = useState<Period>("7d");
  const [openCard, setOpenCard] = useState<string | null>(null);
  const dates = useMemo(() => dateRange(period), [period]);
  const startDate = dates[0];

  const equipmentCards = useMemo<EquipmentCardData[]>(() => {
    return equipments.map(eq => {
      const eqLogs = tempLogs
        .filter(l => l.equipment_name === eq.name && l.log_date >= startDate)
        .sort((a, b) => {
          if (a.log_date !== b.log_date) return b.log_date.localeCompare(a.log_date);
          return a.period === "soir" ? -1 : 1;
        });

      const lastLog = eqLogs[0] ?? null;
      const alertCount = eqLogs.filter(l => isTempAlert(l.temperature, eq.equipment_type)).length;

      let trend: "up" | "down" | "stable" | null = null;
      if (eqLogs.length >= 2) {
        const diff = eqLogs[0].temperature - eqLogs[1].temperature;
        if (diff > 0.5) trend = "up";
        else if (diff < -0.5) trend = "down";
        else trend = "stable";
      }

      // Build daily logs (most recent first)
      const dailyLogs = [...dates].reverse().map(date => {
        const dayLogs = eqLogs.filter(l => l.log_date === date);
        const matin = dayLogs.find(l => l.period === "matin")?.temperature ?? null;
        const soir = dayLogs.find(l => l.period === "soir")?.temperature ?? null;
        const alert = dayLogs.some(l => isTempAlert(l.temperature, eq.equipment_type));
        return { date, matin, soir, alert };
      });

      return {
        name: eq.name,
        type: eq.equipment_type,
        lastTemp: lastLog ? lastLog.temperature : null,
        lastTime: lastLog ? `${lastLog.log_date} ${lastLog.period}` : null,
        trend,
        alertCount,
        dailyLogs,
      };
    });
  }, [equipments, tempLogs, startDate, dates]);

  const cleaningData = useMemo(() => {
    const dailyTasks = cleaningTasks.filter(t => t.frequency === "quotidien").length;
    if (dailyTasks === 0) return dates.map(d => ({ date: d, label: shortLabel(d, period), rate: 0 }));
    return dates.map(date => {
      const doneTasks = new Set(cleaningLogs.filter(l => l.done_date === date).map(l => l.task_id));
      const done = cleaningTasks.filter(t => t.frequency === "quotidien" && doneTasks.has(t.id)).length;
      return { date, label: shortLabel(date, period), rate: Math.round((done / dailyTasks) * 100) };
    });
  }, [cleaningTasks, cleaningLogs, dates, period]);

  const avgCleaningRate = useMemo(() => {
    const vals = cleaningData.filter(d => d.rate > 0).map(d => d.rate);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  }, [cleaningData]);
  const cv = cleanVerdict(avgCleaningRate);

  const tickInterval = period === "7d" ? 0 : period === "30d" ? 4 : 13;
  const periodLabel = period === "7d" ? "7 derniers jours" : period === "30d" ? "30 derniers jours" : "3 derniers mois";

  const TrendIcon = ({ trend }: { trend: "up" | "down" | "stable" | null }) => {
    if (trend === "up") return <TrendingUp className="h-4 w-4 text-destructive" />;
    if (trend === "down") return <TrendingDown className="h-4 w-4 text-emerald-600" />;
    if (trend === "stable") return <Minus className="h-4 w-4 text-muted-foreground" />;
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <div>
            <h3 className="text-lg font-semibold leading-tight">Historique & tendances</h3>
            <p className="text-xs text-muted-foreground">{periodLabel}</p>
          </div>
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList className="h-9">
            <TabsTrigger value="7d" className="text-xs px-3 data-[state=active]:font-semibold">7 jours</TabsTrigger>
            <TabsTrigger value="30d" className="text-xs px-3 data-[state=active]:font-semibold">30 jours</TabsTrigger>
            <TabsTrigger value="90d" className="text-xs px-3 data-[state=active]:font-semibold">3 mois</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* ─── TEMPÉRATURES — Equipment Cards ─── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Thermometer className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-medium">Températures par équipement</h4>
          {equipmentCards.length > 0 && (
            <span className="text-xs text-muted-foreground ml-auto">
              {equipmentCards.filter(c => c.alertCount > 0).length === 0
                ? "✅ Tout conforme"
                : `⚠ ${equipmentCards.filter(c => c.alertCount > 0).length} équipement(s) en alerte`}
            </span>
          )}
        </div>

        {equipmentCards.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Aucun équipement configuré. Ajoutez des équipements dans les réglages HACCP.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {equipmentCards.map(eq => {
              const threshold = eq.type === "congelateur" ? TEMP_THRESHOLD_FREEZER : TEMP_THRESHOLD_FRIDGE;
              const isOpen = openCard === eq.name;
              const logsWithData = eq.dailyLogs.filter(d => d.matin != null || d.soir != null);

              return (
                <Collapsible key={eq.name} open={isOpen} onOpenChange={(o) => setOpenCard(o ? eq.name : null)}>
                  <Card className="relative overflow-hidden transition-shadow hover:shadow-md">
                    {/* Colored accent bar */}
                    <div className={`absolute top-0 left-0 right-0 h-1 ${
                      eq.lastTemp == null ? "bg-muted" :
                      isTempAlert(eq.lastTemp, eq.type) ? "bg-destructive" :
                      "bg-emerald-500"
                    }`} />

                    <CardContent className="p-4 pt-5 space-y-1">
                      {/* Equipment name */}
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground truncate pr-2">{eq.name}</p>
                        <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">
                          {eq.type === "congelateur" ? "congél." : "frigo"}
                        </span>
                      </div>

                      {/* Temperature + trend */}
                      <div className="flex items-end gap-2">
                        {eq.lastTemp != null ? (
                          <>
                            <span className={`text-3xl font-bold tabular-nums leading-none ${tempColorClass(eq.lastTemp, eq.type)}`}>
                              {eq.lastTemp}°
                            </span>
                            <TrendIcon trend={eq.trend} />
                          </>
                        ) : (
                          <span className="text-xl font-medium text-muted-foreground">—</span>
                        )}
                      </div>

                      <p className="text-[10px] text-muted-foreground">Seuil : {threshold}°C</p>

                      {/* Last reading + alerts */}
                      <div className="flex items-center justify-between pt-1">
                        <p className="text-[10px] text-muted-foreground">
                          {eq.lastTime
                            ? `${new Date(eq.lastTime.split(" ")[0] + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} · ${eq.lastTime.split(" ")[1]}`
                            : "Aucun relevé"}
                        </p>
                        {eq.alertCount > 0 && (
                          <span className="text-[10px] font-medium text-destructive">
                            {eq.alertCount} alerte{eq.alertCount > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>

                      {/* Expand button */}
                      {logsWithData.length > 0 && (
                        <CollapsibleTrigger asChild>
                          <button className="flex items-center gap-1 text-[11px] text-primary hover:underline pt-1 w-full justify-center">
                            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                            {isOpen ? "Masquer l'historique" : `Voir l'historique (${logsWithData.length} jour${logsWithData.length > 1 ? "s" : ""})`}
                          </button>
                        </CollapsibleTrigger>
                      )}
                    </CardContent>

                    {/* ── Expandable history table ── */}
                    <CollapsibleContent>
                      <div className="border-t px-3 pb-3 pt-2 max-h-60 overflow-y-auto">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="text-muted-foreground border-b">
                              <th className="text-left py-1 font-medium">Date</th>
                              <th className="text-center py-1 font-medium">Matin</th>
                              <th className="text-center py-1 font-medium">Soir</th>
                              <th className="text-right py-1 font-medium">État</th>
                            </tr>
                          </thead>
                          <tbody>
                            {logsWithData.map(day => (
                              <tr key={day.date} className={`border-b last:border-0 ${day.alert ? "bg-destructive/5" : ""}`}>
                                <td className="py-1.5 text-left text-muted-foreground">{fmtDateFR(day.date)}</td>
                                <td className="py-1.5 text-center">
                                  {day.matin != null ? (
                                    <span className={`font-medium tabular-nums ${tempColorClass(day.matin, eq.type)}`}>
                                      {day.matin}°
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground/50">—</span>
                                  )}
                                </td>
                                <td className="py-1.5 text-center">
                                  {day.soir != null ? (
                                    <span className={`font-medium tabular-nums ${tempColorClass(day.soir, eq.type)}`}>
                                      {day.soir}°
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground/50">—</span>
                                  )}
                                </td>
                                <td className="py-1.5 text-right">
                                  {day.alert ? (
                                    <AlertTriangle className="h-3.5 w-3.5 text-destructive inline" />
                                  ) : (day.matin != null || day.soir != null) ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 inline" />
                                  ) : null}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── NETTOYAGE ─── */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <SprayCan className="h-4 w-4" />
              Nettoyage
            </h4>
            <div className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${cv.bg} ${cv.color}`}>
              <cv.icon className="h-3.5 w-3.5" />
              {cv.text}
            </div>
          </div>
          <ChartContainer config={cleaningChartConfig} className="h-[200px] w-full">
            <BarChart data={cleaningData} margin={{ top: 8, right: 12, left: -15, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted/50" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={tickInterval} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} axisLine={false} tickLine={false} unit="%" />
              <ChartTooltip content={<CleanTooltip />} />
              <ReferenceLine y={80} stroke="hsl(142 71% 45%)" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: "Objectif 80%", position: "insideTopRight", fontSize: 10, fill: "hsl(142 71% 45%)" }} />
              <Bar dataKey="rate" radius={[4, 4, 0, 0]} maxBarSize={period === "90d" ? 8 : period === "30d" ? 12 : 28}>
                {cleaningData.map((entry, idx) => (
                  <Cell key={idx} fill={barColor(entry.rate)} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
          <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[hsl(142_71%_45%)]" /> ≥ 80%</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[hsl(45_93%_47%)]" /> 50-79%</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[hsl(0_72%_51%)]" /> &lt; 50%</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
