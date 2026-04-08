import { useState } from "react";
import { useMemos } from "@/hooks/useMemos";
import { useAuditLog } from "@/hooks/useAuditLog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, StickyNote } from "lucide-react";

interface MemosModuleProps {
  userId: string;
}

export default function MemosModule({ userId }: MemosModuleProps) {
  const { memos, loading, addMemo, deleteMemo } = useMemos(userId);
  const { log: auditLog } = useAuditLog(userId);
  const [draft, setDraft] = useState("");

  const handleAdd = async () => {
    const text = draft.trim();
    if (!text) return;
    await addMemo(text);
    await auditLog("memo_added", `Mémo ajouté : "${text.slice(0, 50)}${text.length > 50 ? "…" : ""}"`);
    setDraft("");
  };

  const handleDelete = async (id: string, content: string) => {
    await deleteMemo(id);
    await auditLog("memo_deleted", `Mémo supprimé : "${content.slice(0, 50)}${content.length > 50 ? "…" : ""}"`);
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <StickyNote className="h-5 w-5" /> Pense-bête
      </h2>

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
        <p className="text-sm text-muted-foreground">Aucun pense-bête pour le moment.</p>
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
    </div>
  );
}
