import { useState, useMemo } from "react";
import { useTemperatureLogs } from "@/hooks/useTemperatureLogs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Thermometer, Info, X, Check } from "lucide-react";
import { todayStr, fmtDate } from "@/lib/constants";

interface TemperaturesModuleProps {
  userId: string;
  equipmentsList: any[];
}

export default function TemperaturesModule({ userId, equipmentsList }: TemperaturesModuleProps) {
  const { logs, addLog, deleteLog } = useTemperatureLogs(userId);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [temps, setTemps] = useState<Record<string, string>>({});
  const [showNormes, setShowNormes] = useState(false);

  const logsForDate = useMemo(() => logs.filter((l: any) => l.log_date === selectedDate), [logs, selectedDate]);
  const getExisting = (equip: string, period: string) => logsForDate.find((l: any) => l.equipment_name === equip && l.period === period);
  const getTempKey = (equip: string, period: string) => `${equip}__${period}`;

  const handleSave = async (equip: string, period: "matin" | "soir") => {
    const key = getTempKey(equip, period);
    const val = temps[key];
    if (val === undefined || val === "") return;
    const temp = parseFloat(val);
    if (isNaN(temp)) return;
    await addLog({ equipment_name: equip, period, temperature: temp, log_date: selectedDate });
    setTemps(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const tempBadgeVariant = (temp: number, equip: any) => {
    const isCongel = equip.equipment_type === "congelateur";
    if (isCongel) { if (temp > -15) return "destructive"; if (temp > -18) return "outline"; return "default"; }
    if (temp > 5) return "destructive";
    if (temp > 3) return "outline";
    return "default";
  };

  const uniqueDates = useMemo(() => [...new Set(logs.map((l: any) => l.log_date))].sort().reverse(), [logs]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Thermometer className="h-5 w-5" /> Relevés de températures
          </h2>
          <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowNormes(v => !v)}>
            <Info className="h-3 w-3 mr-1" />Normes
          </Button>
        </div>
        <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-auto" />
      </div>

      <Collapsible open={showNormes} onOpenChange={setShowNormes}>
        <CollapsibleContent>
          <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 mb-4">
            <CardContent className="p-4 text-xs space-y-1 leading-relaxed">
              <p className="font-bold text-sm mb-2">📏 Normes réglementaires (HACCP)</p>
              <div className="grid grid-cols-2 gap-1">
                <div><strong>🧊 Réfrigérateurs :</strong></div><div>0°C à +3°C — max +5°C</div>
                <div><strong>❄️ Congélateurs :</strong></div><div>-18°C ou moins</div>
                <div><strong>🥩 Viandes fraîches :</strong></div><div>+2°C à +4°C</div>
                <div><strong>🍳 Plats chauds :</strong></div><div>+63°C minimum</div>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {equipmentsList.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          Aucun équipement configuré — allez dans Paramètres HACCP pour en ajouter.
        </CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Équipement</TableHead>
                <TableHead className="text-center">☀️ Matin</TableHead>
                <TableHead className="text-center">🌙 Soir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {equipmentsList.map((equip: any) => (
                <TableRow key={equip.id}>
                  <TableCell className="font-medium">
                    {equip.equipment_type === "congelateur" ? "❄️" : "🧊"} {equip.name}
                  </TableCell>
                  {(["matin", "soir"] as const).map(period => {
                    const existing = getExisting(equip.name, period);
                    const key = getTempKey(equip.name, period);
                    return (
                      <TableCell key={period} className="text-center">
                        {existing ? (
                          <div className="flex items-center justify-center gap-2">
                            <Badge variant={tempBadgeVariant(existing.temperature, equip) as any} className="font-mono">
                              {existing.temperature > 0 ? "+" : ""}{existing.temperature}°C
                            </Badge>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteLog(existing.id)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <Input
                              type="number" step="0.1" value={temps[key] ?? ""}
                              onChange={e => setTemps(prev => ({ ...prev, [key]: e.target.value }))}
                              onKeyDown={e => { if (e.key === "Enter") handleSave(equip.name, period); }}
                              placeholder="°C" className="w-20 text-center h-8"
                            />
                            <Button size="icon" className="h-8 w-8" onClick={() => handleSave(equip.name, period)}
                              disabled={!temps[key] && temps[key] !== "0"}>
                              <Check className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {uniqueDates.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Historique récent</p>
          <div className="flex gap-1.5 flex-wrap">
            {uniqueDates.slice(0, 14).map((d: string) => (
              <Button key={d} variant={d === selectedDate ? "default" : "outline"} size="sm" className="text-xs" onClick={() => setSelectedDate(d)}>
                {fmtDate(d)}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
