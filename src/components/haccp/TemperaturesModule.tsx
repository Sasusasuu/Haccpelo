import { useState, useMemo, useCallback } from "react";
import { useTemperatureLogs } from "@/hooks/useTemperatureLogs";
import { useEmployees } from "@/hooks/useEmployees";
import { useSettings } from "@/hooks/useSettings";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useIdentitySession } from "@/hooks/useIdentitySession";
import IdentifyModal from "@/components/equipe/IdentifyModal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Thermometer, Info, X, Check, Shield } from "lucide-react";
import { todayStr, fmtDate, isTempAlert, TEMP_THRESHOLD_FREEZER, TEMP_THRESHOLD_FRIDGE } from "@/lib/constants";
import { ErrorAlert } from "@/components/ui/error-alert";
import { TableSkeleton } from "@/components/ui/loading-skeletons";

interface TemperaturesModuleProps {
  userId: string;
  equipmentsList: { id: string; name: string; equipment_type: string }[];
}

export default function TemperaturesModule({ userId, equipmentsList }: TemperaturesModuleProps) {
  const { logs, loading, error, addLog, deleteLog, retry } = useTemperatureLogs(userId);
  const { employees } = useEmployees(userId);
  const { planningSessionMinutes } = useSettings(userId);
  const { log: auditLog } = useAuditLog(userId);
  const { identifiedEmployee, isIdentified, startSession, clearSession } = useIdentitySession(planningSessionMinutes);

  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [temps, setTemps] = useState<Record<string, string>>({});
  const [showNormes, setShowNormes] = useState(false);
  const [showIdentify, setShowIdentify] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const requireAuth = useCallback((action: () => void) => {
    if (isIdentified) { action(); } else { setPendingAction(() => action); setShowIdentify(true); }
  }, [isIdentified]);

  const handleIdentified = useCallback((emp: import("@/hooks/useEmployees").Employee) => {
    startSession(emp);
    setShowIdentify(false);
    if (pendingAction) { pendingAction(); setPendingAction(null); }
  }, [startSession, pendingAction]);

  const logsForDate = useMemo(() => logs.filter(l => l.log_date === selectedDate), [logs, selectedDate]);
  const getExisting = (equip: string, period: string) => logsForDate.find(l => l.equipment_name === equip && l.period === period);
  const getTempKey = (equip: string, period: string) => `${equip}__${period}`;

  const handleSave = async (equip: string, period: "matin" | "soir") => {
    const key = getTempKey(equip, period);
    const val = temps[key];
    if (val === undefined || val === "") return;
    const temp = parseFloat(val);
    if (isNaN(temp)) return;
    requireAuth(async () => {
      await addLog({ equipment_name: equip, period, temperature: temp, log_date: selectedDate });
      await auditLog("temp_logged", `Température ${equip} ${period} : ${temp > 0 ? "+" : ""}${temp}°C`, identifiedEmployee?.id ?? null);
      setTemps(prev => { const n = { ...prev }; delete n[key]; return n; });
    });
  };

  const handleDelete = (logId: string, equipName: string, period: string) => {
    requireAuth(async () => {
      await deleteLog(logId);
      await auditLog("temp_deleted", `Suppression relevé ${equipName} ${period}`, identifiedEmployee?.id ?? null);
    });
  };

  const tempBadgeVariant = (temp: number, equip: { equipment_type: string }) => {
    if (isTempAlert(temp, equip.equipment_type)) return "destructive";
    const isCongel = equip.equipment_type === "congelateur";
    if (isCongel && temp > -18) return "outline";
    if (!isCongel && temp > 3) return "outline";
    return "default";
  };

  const uniqueDates = useMemo(() => [...new Set(logs.map(l => l.log_date))].sort().reverse(), [logs]);

  if (error) return <ErrorAlert message={error} onRetry={retry} />;

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
                <div><strong>🧊 Réfrigérateurs :</strong></div><div>0°C à +3°C — max +{TEMP_THRESHOLD_FRIDGE}°C</div>
                <div><strong>❄️ Congélateurs :</strong></div><div>{TEMP_THRESHOLD_FREEZER}°C ou moins</div>
                <div><strong>🥩 Viandes fraîches :</strong></div><div>+2°C à +4°C</div>
                <div><strong>🍳 Plats chauds :</strong></div><div>+63°C minimum</div>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {loading ? (
        <TableSkeleton rows={3} cols={3} />
      ) : equipmentsList.length === 0 ? (
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
              {equipmentsList.map((equip) => (
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
                            <Badge variant={tempBadgeVariant(existing.temperature, equip) as "default" | "destructive" | "outline"} className="font-mono">
                              {existing.temperature > 0 ? "+" : ""}{existing.temperature}°C
                            </Badge>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDelete(existing.id, equip.name, period)}>
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

      <IdentifyModal
        open={showIdentify}
        onClose={() => { setShowIdentify(false); setPendingAction(null); }}
        employees={employees}
        onIdentified={handleIdentified}
        title="Identification requise"
        subtitle="Entrez votre code pour enregistrer un relevé."
      />
    </div>
  );
}
