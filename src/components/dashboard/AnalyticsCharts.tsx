import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  AreaChart,
  Area,
} from "recharts";
import { TemperatureLog } from "@/hooks/useTemperatureLogs";
import { CleaningTask, CleaningLog } from "@/hooks/useCleaningPlan";
import { isTempAlert, TEMP_THRESHOLD_FRIDGE, TEMP_THRESHOLD_FREEZER, statusOf } from "@/lib/constants";
import { Thermometer, SprayCan, ClipboardCheck, TrendingUp } from "lucide-react";

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
  if (period === "30d") return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

const tempChartConfig: ChartConfig = {
  avgTemp: { label: "Moy. (°C)", color: "hsl(var(--primary))" },
  maxTemp: { label: "Max (°C)", color: "hsl(0 84% 60%)" },
  minTemp: { label: "Min (°C)", color: "hsl(210 80% 60%)" },
};

const cleaningChartConfig: ChartConfig = {
  rate: { label: "Conformité %", color: "hsl(var(--primary))" },
};

const dlcChartConfig: ChartConfig = {
  ok: { label: "OK", color: "hsl(142 71% 45%)" },
  urgent: { label: "Urgent", color: "hsl(45 93% 47%)" },
  expired: { label: "Expiré", color: "hsl(0 84% 60%)" },
};

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

  // Temperature trends
  const tempData = useMemo(() => {
    const filtered = tempLogs.filter(l => l.log_date >= startDate);
    return dates.map(date => {
      const dayLogs = filtered.filter(l => l.log_date === date);
      if (dayLogs.length === 0) return { date, label: shortLabel(date, period), avgTemp: null, maxTemp: null, minTemp: null };
      const temps = dayLogs.map(l => l.temperature);
      return {
        date,
        label: shortLabel(date, period),
        avgTemp: Math.round((temps.reduce((a, b) => a + b, 0) / temps.length) * 10) / 10,
        maxTemp: Math.max(...temps),
        minTemp: Math.min(...temps),
      };
    });
  }, [tempLogs, dates, startDate, period]);

  // Temperature alerts count
  const tempAlertCount = useMemo(() => {
    const filtered = tempLogs.filter(l => l.log_date >= startDate);
    return filtered.filter(l => {
      const eq = equipments.find(e => e.name === l.equipment_name);
      return eq ? isTempAlert(l.temperature, eq.equipment_type) : false;
    }).length;
  }, [tempLogs, equipments, startDate]);

  // Cleaning compliance rate per day
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

  // DLC trends: count of ok/urgent/expired per day over the period
  // We approximate by checking product DLCs against each date
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
      return { date, label: shortLabel(date, period), ok, urgent, expired };
    });
  }, [produits, dates, period]);

  // Tick interval for X axis
  const tickInterval = period === "7d" ? 0 : period === "30d" ? 4 : 13;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Historique & tendances</h3>
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList className="h-8">
            <TabsTrigger value="7d" className="text-xs px-3">7 jours</TabsTrigger>
            <TabsTrigger value="30d" className="text-xs px-3">30 jours</TabsTrigger>
            <TabsTrigger value="90d" className="text-xs px-3">3 mois</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Temperature Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Thermometer className="h-4 w-4 text-muted-foreground" />
              Courbe de températures
              {tempAlertCount > 0 && (
                <span className="text-xs text-destructive ml-auto">{tempAlertCount} alerte{tempAlertCount > 1 ? "s" : ""}</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={tempChartConfig} className="h-[220px] w-full">
              <LineChart data={tempData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={tickInterval} />
                <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ReferenceLine y={TEMP_THRESHOLD_FRIDGE} stroke="hsl(0 84% 60%)" strokeDasharray="4 4" label={{ value: `${TEMP_THRESHOLD_FRIDGE}°C`, fontSize: 10, fill: "hsl(0 84% 60%)" }} />
                <Line type="monotone" dataKey="avgTemp" stroke="var(--color-avgTemp)" strokeWidth={2} dot={false} connectNulls />
                <Line type="monotone" dataKey="maxTemp" stroke="var(--color-maxTemp)" strokeWidth={1} strokeDasharray="3 3" dot={false} connectNulls />
                <Line type="monotone" dataKey="minTemp" stroke="var(--color-minTemp)" strokeWidth={1} strokeDasharray="3 3" dot={false} connectNulls />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Cleaning Compliance Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <SprayCan className="h-4 w-4 text-muted-foreground" />
              Taux de conformité nettoyage
              <span className="text-xs text-muted-foreground ml-auto">Moy. {avgCleaningRate}%</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={cleaningChartConfig} className="h-[220px] w-full">
              <BarChart data={cleaningData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={tickInterval} />
                <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ReferenceLine y={100} stroke="hsl(142 71% 45%)" strokeDasharray="4 4" />
                <Bar dataKey="rate" fill="var(--color-rate)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* DLC Trends */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
              Tendances DLC — état du stock par jour
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={dlcChartConfig} className="h-[220px] w-full">
              <AreaChart data={dlcData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={tickInterval} />
                <YAxis tick={{ fontSize: 10 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="ok" stackId="1" fill="var(--color-ok)" stroke="var(--color-ok)" fillOpacity={0.6} />
                <Area type="monotone" dataKey="urgent" stackId="1" fill="var(--color-urgent)" stroke="var(--color-urgent)" fillOpacity={0.6} />
                <Area type="monotone" dataKey="expired" stackId="1" fill="var(--color-expired)" stroke="var(--color-expired)" fillOpacity={0.6} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
