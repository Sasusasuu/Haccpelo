import { useState, useMemo } from "react";
import { useTemperatureLogs } from "@/hooks/useTemperatureLogs";
import { useCleaningPlan } from "@/hooks/useCleaningPlan";
import { useProducts } from "@/hooks/useProducts";
import { useEquipments } from "@/hooks/useEquipments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, Thermometer, SprayCan, ClipboardCheck, AlertTriangle, CheckCircle2, Shield } from "lucide-react";
import { fmtDate, isTempAlert, TEMP_THRESHOLD_FRIDGE, TEMP_THRESHOLD_FREEZER, FREQUENCIES } from "@/lib/constants";
import { CardSkeleton } from "@/components/ui/loading-skeletons";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface HACCPReportModuleProps {
  userId: string;
}

const MONTH_NAMES = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

function getMonthOptions() {
  const opts: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    opts.push({ value: val, label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}` });
  }
  return opts;
}

export default function HACCPReportModule({ userId }: HACCPReportModuleProps) {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [generating, setGenerating] = useState(false);

  const { logs: tempLogs, loading: tempLoading } = useTemperatureLogs(userId);
  const { tasks: cleaningTasks, logs: cleaningLogs, loading: cleanLoading } = useCleaningPlan(userId);
  const { produits, loading: prodLoading } = useProducts(userId);
  const { equipments, loading: equipLoading } = useEquipments(userId);

  const loading = tempLoading || cleanLoading || prodLoading || equipLoading;
  const monthOptions = useMemo(getMonthOptions, []);

  const [year, month] = selectedMonth.split("-").map(Number);
  const firstDay = `${selectedMonth}-01`;
  const lastDay = new Date(year, month, 0).toISOString().split("T")[0];

  // --- Stats ---
  const monthTempLogs = useMemo(() => tempLogs.filter(l => l.log_date >= firstDay && l.log_date <= lastDay), [tempLogs, firstDay, lastDay]);
  const tempAlerts = useMemo(() => monthTempLogs.filter(l => {
    const eq = equipments.find(e => e.name === l.equipment_name);
    return eq ? isTempAlert(l.temperature, eq.equipment_type) : false;
  }), [monthTempLogs, equipments]);

  const monthCleaningLogs = useMemo(() => cleaningLogs.filter(l => l.done_date >= firstDay && l.done_date <= lastDay), [cleaningLogs, firstDay, lastDay]);

  const daysInMonth = new Date(year, month, 0).getDate();
  const expectedCleaningDaily = cleaningTasks.filter(t => t.frequency === "quotidien").length * daysInMonth;
  const expectedCleaningWeekly = cleaningTasks.filter(t => t.frequency === "hebdomadaire").length * Math.ceil(daysInMonth / 7);
  const expectedCleaningMonthly = cleaningTasks.filter(t => t.frequency === "mensuel").length;
  const expectedCleaningTotal = expectedCleaningDaily + expectedCleaningWeekly + expectedCleaningMonthly;

  const monthProducts = useMemo(() => produits.filter(p => {
    return (p.created_at && p.created_at.slice(0, 7) === selectedMonth) || (p.dlc >= firstDay && p.dlc <= lastDay);
  }), [produits, selectedMonth, firstDay, lastDay]);
  const expiredProducts = monthProducts.filter(p => p.dlc <= lastDay && p.dlc <= new Date().toISOString().split("T")[0]);

  const conformityScore = useMemo(() => {
    let score = 100;
    // Temp alerts penalty
    if (monthTempLogs.length > 0) {
      const alertRate = tempAlerts.length / monthTempLogs.length;
      score -= alertRate * 40;
    }
    // Cleaning compliance
    if (expectedCleaningTotal > 0) {
      const cleanRate = Math.min(monthCleaningLogs.length / expectedCleaningTotal, 1);
      score -= (1 - cleanRate) * 30;
    }
    // Expired products penalty
    if (monthProducts.length > 0) {
      const expiredRate = expiredProducts.length / monthProducts.length;
      score -= expiredRate * 30;
    }
    return Math.max(0, Math.round(score));
  }, [monthTempLogs, tempAlerts, monthCleaningLogs, expectedCleaningTotal, monthProducts, expiredProducts]);

  // --- PDF Generation ---
  async function generatePDF() {
    setGenerating(true);
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 14;
      let y = 15;

      // ── Header ──
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("RAPPORT HACCP MENSUEL", pageW / 2, y, { align: "center" });
      y += 8;
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(`${MONTH_NAMES[month - 1]} ${year}`, pageW / 2, y, { align: "center" });
      y += 5;
      doc.text(`Holding NHA — Généré le ${new Date().toLocaleDateString("fr-FR")}`, pageW / 2, y, { align: "center" });
      y += 3;
      doc.setDrawColor(17, 17, 17);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageW - margin, y);
      y += 8;

      // ── Résumé Conformité ──
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("1. Résumé de Conformité", margin, y);
      y += 7;

      const summaryData = [
        ["Indicateur", "Résultat", "Statut"],
        ["Relevés de températures", `${monthTempLogs.length} relevés — ${tempAlerts.length} alerte(s)`, tempAlerts.length === 0 ? "✅ Conforme" : "⚠️ Non-conformités"],
        ["Plan de nettoyage", `${monthCleaningLogs.length} validations / ~${expectedCleaningTotal} attendues`, monthCleaningLogs.length >= expectedCleaningTotal * 0.8 ? "✅ Conforme" : "⚠️ Incomplet"],
        ["Gestion des DLC", `${monthProducts.length} produits suivis — ${expiredProducts.length} expiré(s)`, expiredProducts.length === 0 ? "✅ Conforme" : "⚠️ Produits expirés"],
        ["Score global", `${conformityScore}%`, conformityScore >= 80 ? "✅ Satisfaisant" : conformityScore >= 60 ? "⚠️ À améliorer" : "❌ Insuffisant"],
      ];
      autoTable(doc, {
        head: [summaryData[0]],
        body: summaryData.slice(1),
        startY: y,
        theme: "grid",
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [17, 17, 17], textColor: 255, fontStyle: "bold", halign: "center" as const },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 }, 2: { halign: "center" as const, cellWidth: 40 } },
      });
      y = (doc as any).lastAutoTable.finalY + 10;

      // ── Section 2: Températures ──
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("2. Relevés de Températures", margin, y);
      y += 4;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`Normes : Réfrigérateurs 0°C à +${TEMP_THRESHOLD_FRIDGE}°C max / Congélateurs ${TEMP_THRESHOLD_FREEZER}°C ou moins`, margin, y);
      y += 5;

      if (monthTempLogs.length === 0) {
        doc.setFontSize(9);
        doc.text("Aucun relevé de température enregistré ce mois.", margin, y);
        y += 8;
      } else {
        // Group by equipment
        const byEquip: Record<string, typeof monthTempLogs> = {};
        monthTempLogs.forEach(l => { if (!byEquip[l.equipment_name]) byEquip[l.equipment_name] = []; byEquip[l.equipment_name].push(l); });

        const tempHead = [["Équipement", "Type", "Nb relevés", "Min (°C)", "Max (°C)", "Moyenne (°C)", "Alertes"]];
        const tempBody = Object.entries(byEquip).map(([name, logs]) => {
          const eq = equipments.find(e => e.name === name);
          const type = eq?.equipment_type === "congelateur" ? "Congélateur" : "Réfrigérateur";
          const temps = logs.map(l => l.temperature);
          const min = Math.min(...temps);
          const max = Math.max(...temps);
          const avg = (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1);
          const alerts = logs.filter(l => eq ? isTempAlert(l.temperature, eq.equipment_type) : false).length;
          return [name, type, String(logs.length), min.toFixed(1), max.toFixed(1), avg, String(alerts)];
        });
        autoTable(doc, {
          head: tempHead, body: tempBody, startY: y, theme: "grid",
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 8, halign: "center" as const },
          columnStyles: { 6: { halign: "center" as const } },
        });
        y = (doc as any).lastAutoTable.finalY + 5;

        // Detailed temp alerts
        if (tempAlerts.length > 0) {
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.text("Non-conformités détectées :", margin, y);
          y += 4;
          const alertHead = [["Date", "Équipement", "Période", "Température", "Seuil"]];
          const alertBody = tempAlerts.map(l => {
            const eq = equipments.find(e => e.name === l.equipment_name);
            const seuil = eq?.equipment_type === "congelateur" ? `${TEMP_THRESHOLD_FREEZER}°C` : `+${TEMP_THRESHOLD_FRIDGE}°C`;
            return [fmtDate(l.log_date), l.equipment_name, l.period === "matin" ? "Matin" : "Soir", `${l.temperature > 0 ? "+" : ""}${l.temperature}°C`, seuil];
          });
          autoTable(doc, {
            head: alertHead, body: alertBody, startY: y, theme: "grid",
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [220, 38, 38], textColor: 255, fontSize: 8, halign: "center" as const },
          });
          y = (doc as any).lastAutoTable.finalY + 8;
        } else {
          y += 3;
        }
      }

      // ── Check page break ──
      if (y > 240) { doc.addPage(); y = 15; }

      // ── Section 3: Nettoyage ──
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("3. Plan de Nettoyage", margin, y);
      y += 7;

      if (cleaningTasks.length === 0) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text("Aucune tâche de nettoyage configurée.", margin, y);
        y += 8;
      } else {
        // Summary by zone
        const zones: Record<string, { tasks: typeof cleaningTasks; logs: typeof monthCleaningLogs }> = {};
        cleaningTasks.forEach(t => {
          if (!zones[t.zone]) zones[t.zone] = { tasks: [], logs: [] };
          zones[t.zone].tasks.push(t);
        });
        monthCleaningLogs.forEach(l => {
          const task = cleaningTasks.find(t => t.id === l.task_id);
          if (task && zones[task.zone]) zones[task.zone].logs.push(l);
        });

        const cleanHead = [["Zone", "Tâches", "Validations", "Taux"]];
        const cleanBody = Object.entries(zones).map(([zone, data]) => {
          const validations = data.logs.length;
          // Estimate expected per zone
          let expected = 0;
          data.tasks.forEach(t => {
            if (t.frequency === "quotidien") expected += daysInMonth;
            else if (t.frequency === "hebdomadaire") expected += Math.ceil(daysInMonth / 7);
            else expected += 1;
          });
          const rate = expected > 0 ? Math.round((validations / expected) * 100) : 0;
          return [zone, String(data.tasks.length), String(validations), `${rate}%`];
        });
        autoTable(doc, {
          head: cleanHead, body: cleanBody, startY: y, theme: "grid",
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [22, 163, 74], textColor: 255, fontSize: 8, halign: "center" as const },
          columnStyles: { 3: { halign: "center" as const } },
        });
        y = (doc as any).lastAutoTable.finalY + 5;

        // Detailed task list
        const detailHead = [["Tâche", "Zone", "Fréquence", "Dernière validation", "Par"]];
        const detailBody = cleaningTasks.map(t => {
          const taskLogs = monthCleaningLogs.filter(l => l.task_id === t.id).sort((a, b) => b.done_date.localeCompare(a.done_date));
          const last = taskLogs[0];
          const freq = FREQUENCIES.find(f => f.value === t.frequency);
          return [t.task_name, t.zone, freq?.label ?? t.frequency, last ? fmtDate(last.done_date) : "—", last?.done_by ?? "—"];
        });
        autoTable(doc, {
          head: detailHead, body: detailBody, startY: y, theme: "grid",
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: [22, 163, 74], textColor: 255, fontSize: 7, halign: "center" as const },
        });
        y = (doc as any).lastAutoTable.finalY + 8;
      }

      // ── Check page break ──
      if (y > 210) { doc.addPage(); y = 15; }

      // ── Section 4: DLC ──
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("4. Suivi des DLC (Dates Limites de Consommation)", margin, y);
      y += 7;

      if (monthProducts.length === 0) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text("Aucun produit suivi sur cette période.", margin, y);
        y += 8;
      } else {
        // Category summary
        const byCat: Record<string, typeof monthProducts> = {};
        monthProducts.forEach(p => { if (!byCat[p.categorie]) byCat[p.categorie] = []; byCat[p.categorie].push(p); });

        const catHead = [["Catégorie", "Nb produits", "Expirés", "Conformes"]];
        const catBody = Object.entries(byCat).map(([cat, prods]) => {
          const expired = prods.filter(p => p.dlc <= (new Date().toISOString().split("T")[0])).length;
          return [cat, String(prods.length), String(expired), String(prods.length - expired)];
        });
        autoTable(doc, {
          head: catHead, body: catBody, startY: y, theme: "grid",
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [217, 119, 6], textColor: 255, fontSize: 8, halign: "center" as const },
          columnStyles: { 2: { halign: "center" as const }, 3: { halign: "center" as const } },
        });
        y = (doc as any).lastAutoTable.finalY + 5;

        // Product list
        const prodHead = [["Produit", "Catégorie", "Fabrication", "DLC", "Statut"]];
        const prodBody = monthProducts
          .sort((a, b) => a.dlc.localeCompare(b.dlc))
          .map(p => {
            const today = new Date().toISOString().split("T")[0];
            const status = p.dlc <= today ? "EXPIRÉ" : "OK";
            return [p.nom, p.categorie, fmtDate(p.fab), fmtDate(p.dlc), status];
          });
        autoTable(doc, {
          head: prodHead, body: prodBody, startY: y, theme: "grid",
          styles: { fontSize: 7, cellPadding: 2 },
          headStyles: { fillColor: [217, 119, 6], textColor: 255, fontSize: 7, halign: "center" as const },
          columnStyles: { 4: { halign: "center" as const } },
          didParseCell(data: any) {
            if (data.section === "body" && data.column.index === 4 && data.cell.raw === "EXPIRÉ") {
              data.cell.styles.textColor = [220, 38, 38];
              data.cell.styles.fontStyle = "bold";
            }
          },
        });
        y = (doc as any).lastAutoTable.finalY + 8;
      }

      // ── Footer on each page ──
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        const pageH = doc.internal.pageSize.getHeight();
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(128);
        doc.text(`Rapport HACCP — ${MONTH_NAMES[month - 1]} ${year} — Holding NHA`, margin, pageH - 8);
        doc.text(`Page ${i}/${totalPages}`, pageW - margin, pageH - 8, { align: "right" });
        doc.text("Document généré automatiquement — À conserver pour contrôle sanitaire", pageW / 2, pageH - 4, { align: "center" });
        doc.setTextColor(0);
      }

      doc.save(`rapport_haccp_${MONTH_NAMES[month - 1]}_${year}.pdf`);
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <CardSkeleton count={3} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5" /> Rapport HACCP
          </h2>
          <p className="text-sm text-muted-foreground">Document récapitulatif pour contrôle sanitaire</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={generatePDF} disabled={generating} className="gap-2">
            <Download className="h-4 w-4" />
            {generating ? "Génération…" : "Télécharger PDF"}
          </Button>
        </div>
      </div>

      {/* Preview cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Score conformité</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${conformityScore >= 80 ? "text-green-600" : conformityScore >= 60 ? "text-yellow-600" : "text-destructive"}`}>
              {conformityScore}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {conformityScore >= 80 ? "Satisfaisant" : conformityScore >= 60 ? "À améliorer" : "Insuffisant"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Températures</CardTitle>
            <Thermometer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthTempLogs.length}</div>
            <p className="text-xs text-muted-foreground">relevés ce mois</p>
            {tempAlerts.length > 0 ? (
              <Badge variant="destructive" className="mt-1">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {tempAlerts.length} alerte{tempAlerts.length > 1 ? "s" : ""}
              </Badge>
            ) : monthTempLogs.length > 0 ? (
              <Badge variant="outline" className="mt-1 border-green-500 text-green-600">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Conforme
              </Badge>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Nettoyage</CardTitle>
            <SprayCan className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthCleaningLogs.length}</div>
            <p className="text-xs text-muted-foreground">validations / ~{expectedCleaningTotal} attendues</p>
            {expectedCleaningTotal > 0 && (
              <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${Math.min((monthCleaningLogs.length / expectedCleaningTotal) * 100, 100)}%` }}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Produits DLC</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{monthProducts.length}</div>
            <p className="text-xs text-muted-foreground">produits suivis</p>
            {expiredProducts.length > 0 && (
              <Badge variant="destructive" className="mt-1">
                {expiredProducts.length} expiré{expiredProducts.length > 1 ? "s" : ""}
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Info card */}
      <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Document pour inspecteur sanitaire</p>
              <p className="text-xs text-muted-foreground">
                Le rapport PDF contient : le résumé de conformité, le détail des relevés de températures avec les non-conformités,
                le suivi du plan de nettoyage par zone, et l'inventaire des DLC avec les produits expirés.
                Ce document est conforme aux exigences HACCP et peut être présenté lors d'un contrôle.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}