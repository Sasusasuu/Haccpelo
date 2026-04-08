import { useState, useCallback } from "react";
import { useMemos } from "@/hooks/useMemos";
import { useEmployees } from "@/hooks/useEmployees";
import { useSettings } from "@/hooks/useSettings";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useIdentitySession } from "@/hooks/useIdentitySession";
import IdentifyModal from "@/components/equipe/IdentifyModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, StickyNote, Shield } from "lucide-react";

interface MemosModuleProps {
  userId: string;
}

export default function MemosModule({ userId }: MemosModuleProps) {
  const { memos, loading, addMemo, deleteMemo } = useMemos(userId);
  const { employees } = useEmployees(userId);
  const { planningSessionMinutes, verifyPin } = useSettings(userId);
  const { log: auditLog } = useAuditLog(userId);
  const { identifiedEmployee, isIdentified, startSession, clearSession } = useIdentitySession(planningSessionMinutes);

  const [draft, setDraft] = useState("");
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

  const handleAdd = () => {
    const text = draft.trim();
    if (!text) return;
    requireAuth(async () => {
      await addMemo(text);
      await auditLog("memo_added", `Note ajoutée : "${text.slice(0, 50)}${text.length > 50 ? "…" : ""}"`, identifiedEmployee?.id ?? null, identifiedEmployee?.name ?? null);
      setDraft("");
    });
  };

  const handleDelete = (id: string, content: string) => {
    requireAuth(async () => {
      await deleteMemo(id);
      await auditLog("memo_deleted", `Note supprimée : "${content.slice(0, 50)}${content.length > 50 ? "…" : ""}"`, identifiedEmployee?.id ?? null, identifiedEmployee?.name ?? null);
    });
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <StickyNote className="h-5 w-5" /> Notes partagées
      </h2>

      {isIdentified && identifiedEmployee && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Shield className="h-3.5 w-3.5 text-primary" />
          Identifié : <strong>{identifiedEmployee.name}</strong>
          <Button variant="ghost" size="sm" className="h-5 text-[10px] ml-auto" onClick={clearSession}>Verrouiller</Button>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Nouveau mémo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Écrire un message, une note, un rappel…"
            className="min-h-[80px]"
            onKeyDown={e => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Ctrl+Entrée pour envoyer</span>
            <Button onClick={handleAdd} disabled={!draft.trim()} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Ajouter
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : memos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune note partagée pour le moment.</p>
      ) : (
        <div className="space-y-2">
          {memos.map(memo => (
            <Card key={memo.id} className="group">
              <CardContent className="p-4 flex gap-3 items-start">
                <p className="flex-1 text-sm whitespace-pre-wrap">{memo.content}</p>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDelete(memo.id, memo.content)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(memo.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <IdentifyModal
        open={showIdentify}
        onClose={() => { setShowIdentify(false); setPendingAction(null); }}
        employees={employees}
        onIdentified={handleIdentified}
        verifyManagerPin={verifyPin}
        title="Identification requise"
        subtitle="Entrez votre code pour modifier les notes partagées."
      />
    </div>
  );
}
