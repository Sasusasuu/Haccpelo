import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  AreaChart,
  Area,
  Cell,
} from "recharts";
import { TemperatureLog } from "@/hooks/useTemperatureLogs";
import { CleaningTask, CleaningLog } from "@/hooks/useCleaningPlan";
import { isTempAlert, TEMP_THRESHOLD_FRIDGE } from "@/lib/constants";
import {
  Thermometer,
  SprayCan,
  ClipboardCheck,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";

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

// ── Verdict helpers ──

function tempVerdict(alertCount: number, totalLogs: number) {
  if (totalLogs === 0) return { icon: AlertTriangle, text: "Aucun relevé", color: "text-muted-foreground", bg: "bg-muted" };
  if (alertCount === 0) return { icon: CheckCircle2, text: "Tout conforme", color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30" };
  return { icon: XCircle, text: `${alertCount} hors norme${alertCount > 1 ? "s" : ""}`, color: "text-destructive", bg: "bg-destructive/10" };
}

function cleanVerdict(avgRate: number) {
  if (avgRate >= 90) return { icon: CheckCircle2, text: `${avgRate}% — Excellent`, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30" };
  if (avgRate >= 60) return { icon: AlertTriangle, text: `${avgRate}% — À améliorer`, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30" };
  return { icon: XCircle, text: `${avgRate}% — Insuffisant`, color: "text-destructive", bg: "bg-destructive/10" };
}

// ── Chart configs ──

const tempChartConfig: ChartConfig = {
  avgTemp: { label: "Température moyenne", color: "hsl(210 80% 55%)" },
};

const cleaningChartConfig: ChartConfig = {
  rate: { label: "Réalisé", color: "hsl(142 71% 45%)" },
};

const dlcChartConfig: ChartConfig = {
  ok: { label: "✅ Conforme", color: "hsl(142 71% 45%)" },
  urgent: { label: "⚠️ J-1", color: "hsl(45 93% 47%)" },
  expired: { label: "❌ Expiré", color: "hsl(0 72% 51%)" },
};

// ── Custom tooltip formatters ──

function TempTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-lg space-y-1">
      <p className="font-medium">{label}</p>
      {d?.avgTemp != null && <p>Moyenne : <strong>{d.avgTemp}°C</strong></p>}
      {d?.maxTemp != null && d?.minTemp != null && (
        <p className="text-muted-foreground">Min {d.minTemp}°C · Max {d.maxTemp}°C</p>
      )}
      {d?.alerts > 0 && <p className="text-destructive font-medium">⚠ {d.alerts} alerte{d.alerts > 1 ? "s" : ""}</p>}
    </div>
  );
}

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

// ── Bar color helper ──
function barColor(rate: number): string {
  if (rate >= 80) return "hsl(142 71% 45%)";
  if (rate >= 50) return "hsl(45 93% 47%)";
  return "hsl(0 72% 51%)";
}

export default function AnalyticsCharts({
  tempLogs,
  cleaningTasks,
  cleaningLogs,
  equipments,
  produits,
}: AnalyticsChartsProps) {
  const [period, setPeriod] = useState<Period>("7d");
  const dates = useMemo(() => dateRange(period), [period]);
  const startDate = dates[0];

  // ── Temperature data ──
  const tempData = useMemo(() => {
    const filtered = tempLogs.filter(l => l.log_date >= startDate);
    return dates.map(date => {
      const dayLogs = filtered.filter(l => l.log_date === date);
      if (dayLogs.length === 0) return { date, label: shortLabel(date, period), avgTemp: null, maxTemp: null, minTemp: null, alerts: 0 };
      const temps = dayLogs.map(l => l.temperature);
      const alerts = dayLogs.filter(l => {
        const eq = equipments.find(e => e.name === l.equipment_name);
        return eq ? isTempAlert(l.temperature, eq.equipment_type) : false;
      }).length;
      return {
        date,
        label: shortLabel(date, period),
        avgTemp: Math.round((temps.reduce((a, b) => a + b, 0) / temps.length) * 10) / 10,
        maxTemp: Math.max(...temps),
        minTemp: Math.min(...temps),
        alerts,
      };
    });
  }, [tempLogs, dates, startDate, period, equipments]);

  const tempAlertCount = useMemo(() => tempData.reduce((s, d) => s + (d.alerts ?? 0), 0), [tempData]);
  const tempTotalLogs = useMemo(() => tempLogs.filter(l => l.log_date >= startDate).length, [tempLogs, startDate]);
  const tv = tempVerdict(tempAlertCount, tempTotalLogs);

  // ── Cleaning data ──
  const cleaningData = useMemo(() => {
    const dailyTasks = cleaningTasks.filter(t => t.frequency === "quotidien").length;
    if (dailyTasks === 0) return dates.map(d => ({ date: d, label: shortLabel(d, period), rate: 0 }));
    return dates.map(date => {
      const doneTasks = new Set(cleaningLogs.filter(l => l.done_date === date).map(l => l.task_id));
      const done = cleaningTasks.filter(t => t.frequency === "quotidien" && doneTasks.has(t.id)).length;
      return {
        date,
        label: shortLabel(date, period),
        rate: Math.round((done / dailyTasks) * 100),
      };
    });
  }, [cleaningTasks, cleaningLogs, dates, period]);

  const avgCleaningRate = useMemo(() => {
    const vals = cleaningData.filter(d => d.rate > 0).map(d => d.rate);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  }, [cleaningData]);
  const cv = cleanVerdict(avgCleaningRate);

  // ── DLC data ──
  const dlcData = useMemo(() => {
    return dates.map(date => {
      let ok = 0, urgent = 0, expired = 0;
      const tomorrow = new Date(date + "T00:00:00");
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split("T")[0];
      produits.forEach(p => {
        if (!p.dlc) { ok++; return; }
        if (p.dlc <= date) expired++;
        else if (p.dlc <= tomorrowStr) urgent++;
        else ok++;
      });
      return { date, label: shortLabel(date, period), ok, urgent, expired, total: ok + urgent + expired };
    });
  }, [produits, dates, period]);

  const lastDlc = dlcData[dlcData.length - 1];

  const tickInterval = period === "7d" ? 0 : period === "30d" ? 4 : 13;
  const periodLabel = period === "7d" ? "7 derniers jours" : period === "30d" ? "30 derniers jours" : "3 derniers mois";

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

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ─── TEMPÉRATURES ─── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Thermometer className="h-4 w-4" />
                Températures
              </CardTitle>
              <div className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${tv.bg} ${tv.color}`}>
                <tv.icon className="h-3.5 w-3.5" />
                {tv.text}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ChartContainer config={tempChartConfig} className="h-[200px] w-full">
              <AreaChart data={tempData} margin={{ top: 8, right: 12, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(210 80% 55%)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(210 80% 55%)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted/50" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={tickInterval} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} unit="°" />
                <ChartTooltip content={<TempTooltip />} />
                <ReferenceLine
                  y={TEMP_THRESHOLD_FRIDGE}
                  stroke="hsl(0 72% 51%)"
                  strokeDasharray="6 3"
                  strokeWidth={1.5}
                  label={{ value: `Seuil ${TEMP_THRESHOLD_FRIDGE}°C`, position: "insideTopRight", fontSize: 10, fill: "hsl(0 72% 51%)" }}
                />
                <Area type="monotone" dataKey="avgTemp" stroke="hsl(210 80% 55%)" strokeWidth={2.5} fill="url(#tempGrad)" dot={false} connectNulls />
              </AreaChart>
            </ChartContainer>
            {/* Legend inline */}
            <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[hsl(210_80%_55%)]" /> Moyenne</span>
              <span className="flex items-center gap-1"><span className="h-0.5 w-3 border-t-2 border-dashed border-destructive" /> Seuil max</span>
            </div>
          </CardContent>
        </Card>

        {/* ─── NETTOYAGE ─── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <SprayCan className="h-4 w-4" />
                Nettoyage
              </CardTitle>
              <div className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${cv.bg} ${cv.color}`}>
                <cv.icon className="h-3.5 w-3.5" />
                {cv.text}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
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

        {/* ─── DLC ─── */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4" />
                Suivi DLC — état du stock
              </CardTitle>
              {lastDlc && (
                <div className="flex items-center gap-2">
                  {lastDlc.expired > 0 && <Badge variant="destructive" className="text-[10px] px-2 py-0.5">{lastDlc.expired} expiré{lastDlc.expired > 1 ? "s" : ""}</Badge>}
                  {lastDlc.urgent > 0 && <Badge className="text-[10px] px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-white">{lastDlc.urgent} urgent{lastDlc.urgent > 1 ? "s" : ""}</Badge>}
                  {lastDlc.ok > 0 && <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-emerald-500 text-emerald-600">{lastDlc.ok} OK</Badge>}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ChartContainer config={dlcChartConfig} className="h-[200px] w-full">
              <AreaChart data={dlcData} margin={{ top: 8, right: 12, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="dlcOk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(142 71% 45%)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(142 71% 45%)" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="dlcUrgent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(45 93% 47%)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(45 93% 47%)" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="dlcExpired" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(0 72% 51%)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(0 72% 51%)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted/50" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={tickInterval} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="ok" stackId="1" fill="url(#dlcOk)" stroke="hsl(142 71% 45%)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="urgent" stackId="1" fill="url(#dlcUrgent)" stroke="hsl(45 93% 47%)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="expired" stackId="1" fill="url(#dlcExpired)" stroke="hsl(0 72% 51%)" strokeWidth={1.5} />
              </AreaChart>
            </ChartContainer>
            <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[hsl(142_71%_45%)]" /> Conforme</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[hsl(45_93%_47%)]" /> J-1</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[hsl(0_72%_51%)]" /> Expiré</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
