import { useState, useRef, useMemo, useCallback } from "react";
import { useProducts } from "@/hooks/useProducts";
import { useEmployees } from "@/hooks/useEmployees";
import { useSettings } from "@/hooks/useSettings";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useIdentitySession } from "@/hooks/useIdentitySession";
import IdentifyModal from "@/components/equipe/IdentifyModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Pencil, Trash2, Tag, Printer, Camera, Sparkles, Info, Shield } from "lucide-react";
import { CATEGORIES, statusOf, fmtDate, todayStr, tomorrowStr, makeDefaultForm } from "@/lib/constants";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface DLCModuleProps {
  userId: string;
}

export default function DLCModule({ userId }: DLCModuleProps) {
  const { produits, addProduct, updateProduct, deleteProduct, uploadPhoto } = useProducts(userId);
  const { employees } = useEmployees(userId);
  const { planningSessionMinutes } = useSettings(userId);
  const { log: auditLog } = useAuditLog(userId);
  const { identifiedEmployee, isIdentified, startSession, clearSession } = useIdentitySession(planningSessionMinutes);

  const [form, setForm] = useState(makeDefaultForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [view, setView] = useState<"liste" | "ajouter" | "etiquette">("liste");
  const [etiquette, setEtiquette] = useState<any>(null);
  const [filtre, setFiltre] = useState("tous");
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<any>(null);
  const [showNormes, setShowNormes] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleSubmit = async () => {
    if (!form.nom || !form.dlc) return;
    if (editId !== null) {
      await updateProduct(editId, form);
      setEditId(null);
    } else {
      await addProduct(form);
    }
    setForm(makeDefaultForm());
    setView("liste");
  };

  const filtered = useMemo(() =>
    produits.filter((p: any) => {
      const st = statusOf(p.dlc);
      const matchF = filtre === "tous" || (filtre === "alerte" && (st === "expire" || st === "urgent")) || (filtre === "ok" && st === "ok");
      const matchS = p.nom.toLowerCase().includes(search.toLowerCase()) || p.categorie.toLowerCase().includes(search.toLowerCase());
      return matchF && matchS;
    }).sort((a: any, b: any) => (a.dlc || "").localeCompare(b.dlc || ""))
  , [produits, filtre, search]);

  const nbAlerte = useMemo(() =>
    produits.filter((p: any) => { const s = statusOf(p.dlc); return s === "expire" || s === "urgent"; }).length
  , [produits]);

  const getStatusBadge = (dlc: string) => {
    const s = statusOf(dlc);
    if (s === "expire") return <Badge variant="destructive">Expiré</Badge>;
    if (s === "urgent") return <Badge variant="outline" className="border-yellow-500 text-yellow-600 dark:text-yellow-400">Demain</Badge>;
    return <Badge variant="outline" className="border-green-500 text-green-600 dark:text-green-400">OK</Badge>;
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setScanResult(null);
    try {
      const url = await uploadPhoto(file);
      if (url) {
        setForm(prev => ({ ...prev, photo_url: url }));
        setScanning(true);
        try {
          const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scan-product`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
            body: JSON.stringify({ image_url: url }),
          });
          if (res.ok) { const data = await res.json(); if (data.nom) setScanResult(data); }
        } catch (err) { console.error("Scan error:", err); }
        finally { setScanning(false); }
      }
    } catch (err) { console.error("Photo upload error:", err); }
    finally { setUploading(false); }
  };

  const applyScan = () => {
    if (!scanResult) return;
    const updates: any = {};
    if (scanResult.nom) updates.nom = scanResult.nom;
    if (scanResult.categorie) updates.categorie = scanResult.categorie;
    if (scanResult.fab) updates.fab = scanResult.fab;
    if (scanResult.dlc) updates.dlc = scanResult.dlc;
    setForm(prev => ({ ...prev, ...updates }));
    setScanResult(null);
  };

  const handleSuggestDLC = async () => {
    if (!form.nom) return;
    setAiLoading(true);
    setAiSuggestion(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/suggest-dlc`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ nom: form.nom, categorie: form.categorie, fab: form.fab }),
      });
      if (!res.ok) throw new Error("Erreur IA");
      const data = await res.json();
      if (data.dlc) setAiSuggestion(data);
    } catch { setAiSuggestion({ error: true }); }
    finally { setAiLoading(false); }
  };

  const applySuggestion = () => {
    if (aiSuggestion?.dlc) {
      const updates: any = { dlc: aiSuggestion.dlc };
      if (aiSuggestion.categorie) updates.categorie = aiSuggestion.categorie;
      setForm({ ...form, ...updates });
      setAiSuggestion(null);
    }
  };

  if (view === "etiquette" && etiquette) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2 no-print">
          <Button variant="outline" onClick={() => setView("liste")}>← Retour</Button>
          <Button onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" />Imprimer
          </Button>
        </div>
        <div className="flex justify-center">
          <div className="w-72 border-2 border-foreground rounded p-4 text-center font-mono bg-card">
            <div className="text-[11px] tracking-[2px] uppercase border-b border-foreground pb-1.5 mb-2.5">Holding NHA</div>
            <div className="text-xl font-bold my-2.5">{etiquette.nom}</div>
            <div className="text-sm mb-1.5">{etiquette.categorie}</div>
            {etiquette.quantite && <div className="text-sm mb-2">{etiquette.quantite}</div>}
            <div className="border-t border-foreground pt-2 mt-2">
              <div className="text-[11px] mb-0.5">DATE DE FABRICATION</div>
              <div className="text-lg font-bold">{fmtDate(etiquette.fab)}</div>
            </div>
            <div className="border-t border-foreground pt-2 mt-2">
              <div className="text-[11px] mb-0.5">DATE LIMITE DE CONSOMMATION</div>
              <div className="text-[22px] font-bold">{fmtDate(etiquette.dlc)}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === "ajouter") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{editId ? "Modifier le produit" : "Nouveau produit"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Nom du produit *</Label>
              <Input value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} placeholder="Ex: Filet de bœuf" />
            </div>
            <div className="space-y-1.5">
              <Label>Catégorie</Label>
              <Select value={form.categorie} onValueChange={v => setForm({ ...form, categorie: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date de fabrication</Label>
              <Input type="date" value={form.fab} onChange={e => setForm({ ...form, fab: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Date DLC *</Label>
              <Input type="date" value={form.dlc} onChange={e => setForm({ ...form, dlc: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Quantité</Label>
              <Input value={form.quantite} onChange={e => setForm({ ...form, quantite: e.target.value })} placeholder="Ex: 2kg" />
            </div>
          </div>

          {/* Photo / Scan */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2"><Camera className="h-4 w-4" /> Photo traçabilité — Scan IA</Label>
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
            <div className="flex gap-3 items-start">
              <div className="shrink-0">
                {form.photo_url ? (
                  <img src={form.photo_url} alt="Photo produit" className="w-24 h-24 rounded-lg object-cover border" />
                ) : (
                  <div className="w-24 h-24 rounded-lg bg-muted border border-dashed flex items-center justify-center text-2xl text-muted-foreground">📷</div>
                )}
                <div className="flex flex-col gap-1 mt-1.5">
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => fileInputRef.current?.click()} disabled={uploading || scanning}>
                    {uploading ? "Envoi..." : scanning ? "Scan..." : form.photo_url ? "Changer" : "📷 Photo"}
                  </Button>
                  {form.photo_url && (
                    <Button variant="outline" size="sm" className="text-xs text-destructive" onClick={() => { setForm({ ...form, photo_url: "" }); setScanResult(null); }}>Supprimer</Button>
                  )}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                {scanning && (
                  <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
                    <CardContent className="p-3 text-center">
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-300">🔍 Analyse en cours...</p>
                      <p className="text-xs text-muted-foreground mt-1">L'IA scanne la photo</p>
                    </CardContent>
                  </Card>
                )}
                {scanResult && !scanning && (
                  <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-green-700 dark:text-green-300">✅ Infos détectées</span>
                        <Button size="sm" onClick={applyScan} className="bg-green-600 hover:bg-green-700 text-xs">Remplir</Button>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        {scanResult.nom && <div><span className="text-muted-foreground">Produit:</span> {scanResult.nom}</div>}
                        {scanResult.categorie && <div><span className="text-muted-foreground">Cat:</span> {scanResult.categorie}</div>}
                        {scanResult.dlc && <div><span className="text-muted-foreground">DLC:</span> {fmtDate(scanResult.dlc)}</div>}
                        {scanResult.fab && <div><span className="text-muted-foreground">Fab:</span> {fmtDate(scanResult.fab)}</div>}
                      </div>
                    </CardContent>
                  </Card>
                )}
                {!scanning && !scanResult && (
                  <Card className="border-dashed">
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-muted-foreground">{form.photo_url ? "Aucune info détectée." : "Prenez une photo pour un scan IA automatique"}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>

          {/* AI Suggestion */}
          <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Assistant IA — Suggestion DLC</span>
                <Button size="sm" variant="secondary" className="ml-auto text-xs" onClick={handleSuggestDLC} disabled={!form.nom || aiLoading}>
                  {aiLoading ? "Analyse..." : "Suggérer DLC"}
                </Button>
              </div>
              {aiSuggestion && !aiSuggestion.error && (
                <div className="mt-2 p-2 bg-card rounded border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">DLC suggérée : {fmtDate(aiSuggestion.dlc)}</span>
                    <Button size="sm" onClick={applySuggestion} className="bg-green-600 hover:bg-green-700 text-xs">Appliquer</Button>
                  </div>
                  {aiSuggestion.explication && <p className="text-xs text-muted-foreground mt-1">{aiSuggestion.explication}</p>}
                </div>
              )}
              {aiSuggestion?.error && <p className="text-xs text-destructive mt-2">Impossible d'obtenir une suggestion.</p>}
              {!aiSuggestion && !aiLoading && <p className="text-xs text-muted-foreground mt-1">Entrez un nom puis cliquez "Suggérer DLC".</p>}
            </CardContent>
          </Card>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => { setView("liste"); setEditId(null); setForm(makeDefaultForm()); }}>Annuler</Button>
            <Button onClick={handleSubmit} disabled={!form.nom || !form.dlc}>{editId ? "Enregistrer" : "Ajouter"}</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Produits</h2>
          {nbAlerte > 0 && <Badge variant="destructive">{nbAlerte} alerte{nbAlerte > 1 ? "s" : ""}</Badge>}
          <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowNormes(v => !v)}>
            <Info className="h-3 w-3 mr-1" />Normes DLC
          </Button>
        </div>
        <Button onClick={() => { setForm(makeDefaultForm()); setEditId(null); setView("ajouter"); }}>
          <Plus className="h-4 w-4 mr-2" />Ajouter
        </Button>
      </div>

      {/* Normes */}
      <Collapsible open={showNormes} onOpenChange={setShowNormes}>
        <CollapsibleContent>
          <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 mb-4">
            <CardContent className="p-4 text-sm space-y-1 leading-relaxed">
              <p className="font-bold text-sm mb-2">📏 Normes DLC réglementaires (HACCP)</p>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <div><strong>🥩 Viandes fraîches :</strong></div><div>DLC 3 à 5 jours après ouverture</div>
                <div><strong>🐟 Poissons frais :</strong></div><div>DLC 1 à 2 jours max</div>
                <div><strong>🥛 Produits laitiers :</strong></div><div>2-3 jours après ouverture</div>
                <div><strong>🥗 Préparations maison :</strong></div><div>DLC J+3 max (72h)</div>
                <div><strong>❄️ Décongelés :</strong></div><div>24h — NE PAS recongeler</div>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Tabs value={filtre} onValueChange={setFiltre}>
          <TabsList>
            <TabsTrigger value="tous">Tous ({produits.length})</TabsTrigger>
            <TabsTrigger value="alerte">Alertes ({nbAlerte})</TabsTrigger>
            <TabsTrigger value="ok">OK</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          {produits.length > 0 ? "Aucun produit correspondant" : "Aucun produit — cliquez + Ajouter"}
        </CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Produit</TableHead>
                <TableHead className="hidden sm:table-cell">Catégorie</TableHead>
                <TableHead>DLC</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right no-print">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="p-2">
                    {p.photo_url ? (
                      <img src={p.photo_url} alt={p.nom} className="w-8 h-8 rounded object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-sm">📷</div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{p.nom}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{p.categorie}</TableCell>
                  <TableCell className="font-mono text-sm">{fmtDate(p.dlc)}</TableCell>
                  <TableCell>{getStatusBadge(p.dlc)}</TableCell>
                  <TableCell className="text-right no-print">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEtiquette(p); setView("etiquette"); }}>
                        <Tag className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setForm({ nom: p.nom, categorie: p.categorie, dlc: p.dlc, quantite: p.quantite || "", fab: p.fab || todayStr(), photo_url: p.photo_url || "" }); setEditId(p.id); setView("ajouter"); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setConfirmDelete(p)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Delete Confirm Dialog */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Supprimer ce produit ?</DialogTitle>
          </DialogHeader>
          {confirmDelete && (
            <div className="text-center py-2">
              <p className="font-bold text-lg">{confirmDelete.nom}</p>
              <p className="text-sm text-muted-foreground">{confirmDelete.categorie}</p>
              <p className="text-sm font-mono mt-1">DLC : {fmtDate(confirmDelete.dlc)}</p>
            </div>
          )}
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Annuler</Button>
            <Button variant="destructive" onClick={async () => { await deleteProduct(confirmDelete.id); setConfirmDelete(null); }}>Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
