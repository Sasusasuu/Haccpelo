import { useState, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

import { CGU_TEXT, CGV_TEXT, PRIVACY_TEXT, LEGAL_VERSION } from "@/constants/legalTexts";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { toast } from "sonner";

import LogoutButton from "@/components/LogoutButton";

interface LegalOnboardingProps {
  userId: string;
  onComplete: () => Promise<void> | void;
  onSignOut: () => void;
}

function useScrollDetection() {
  const [hasRead, setHasRead] = useState(false);
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    // If content doesn't overflow, mark as read immediately
    if (node.scrollHeight <= node.clientHeight + 30) {
      setHasRead(true);
    }
  }, []);
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 30) {
      setHasRead(true);
    }
  }, []);
  return { hasRead, handleScroll, containerRef };
}

function LegalTextPanel({
  text,
  onScroll,
  containerRef,
}: {
  text: string;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  containerRef: (node: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={containerRef}
      className="h-[50vh] overflow-y-auto border rounded-md p-4 bg-muted/30 text-sm leading-relaxed whitespace-pre-line"
      onScroll={onScroll}
    >
      {text}
    </div>
  );
}

export default function LegalOnboarding({ userId, onComplete, onSignOut }: LegalOnboardingProps) {
  const cgu = useScrollDetection();
  const cgv = useScrollDetection();
  const privacy = useScrollDetection();

  const [acceptedCgu, setAcceptedCgu] = useState(false);
  const [acceptedCgv, setAcceptedCgv] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const allAccepted = acceptedCgu && acceptedCgv && acceptedPrivacy;

  const handleSubmit = async () => {
    if (!allAccepted) return;
    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const legalPayload: TablesUpdate<"settings"> = {
        cgu_accepted_at: now,
        cgv_accepted_at: now,
        privacy_policy_accepted_at: now,
        legal_documents_version: LEGAL_VERSION,
        onboarding_completed: true,
      };

      const { data: existingRow, error: existingRowError } = await supabase
        .from("settings")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existingRowError) throw existingRowError;

      if (existingRow) {
        const { error } = await supabase
          .from("settings")
          .update(legalPayload)
          .eq("id", existingRow.id);
        if (error) throw error;
      } else {
        const insertPayload: TablesInsert<"settings"> = {
          user_id: userId,
          ...legalPayload,
        };
        const { error } = await supabase.from("settings").insert(insertPayload);
        if (error) throw error;
      }

      toast.success("Documents légaux acceptés.");
      await onComplete();
    } catch (err) {
      console.error("[LegalOnboarding] Error:", err);
      toast.error("Erreur lors de la validation. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-3xl flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-center">Documents légaux</h1>
        <p className="text-muted-foreground text-center text-sm">
          Veuillez lire et accepter les documents suivants pour continuer. Vous devez faire défiler chaque document jusqu'en bas avant de pouvoir cocher la case correspondante.
        </p>

        <Tabs defaultValue="cgu" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="cgu">
              CGU {cgu.hasRead && "✓"}
            </TabsTrigger>
            <TabsTrigger value="cgv">
              CGV {cgv.hasRead && "✓"}
            </TabsTrigger>
            <TabsTrigger value="privacy">
              Confidentialité {privacy.hasRead && "✓"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cgu">
            <LegalTextPanel text={CGU_TEXT} onScroll={cgu.handleScroll} containerRef={cgu.containerRef} />
          </TabsContent>
          <TabsContent value="cgv">
            <LegalTextPanel text={CGV_TEXT} onScroll={cgv.handleScroll} containerRef={cgv.containerRef} />
          </TabsContent>
          <TabsContent value="privacy">
            <LegalTextPanel text={PRIVACY_TEXT} onScroll={privacy.handleScroll} containerRef={privacy.containerRef} />
          </TabsContent>
        </Tabs>

        <div className="flex flex-col gap-3 pt-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={acceptedCgu}
              onCheckedChange={(v) => setAcceptedCgu(v === true)}
              disabled={!cgu.hasRead}
            />
            <span className={!cgu.hasRead ? "text-muted-foreground" : ""}>
              J'ai lu et j'accepte les Conditions Générales d'Utilisation
            </span>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={acceptedCgv}
              onCheckedChange={(v) => setAcceptedCgv(v === true)}
              disabled={!cgv.hasRead}
            />
            <span className={!cgv.hasRead ? "text-muted-foreground" : ""}>
              J'ai lu et j'accepte les Conditions Générales de Vente
            </span>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={acceptedPrivacy}
              onCheckedChange={(v) => setAcceptedPrivacy(v === true)}
              disabled={!privacy.hasRead}
            />
            <span className={!privacy.hasRead ? "text-muted-foreground" : ""}>
              J'ai lu et j'accepte la Politique de Confidentialité
            </span>
          </label>
        </div>

        <Button
          className="w-full mt-2"
          disabled={!allAccepted || submitting}
          onClick={handleSubmit}
        >
          {submitting ? "Validation…" : "Valider et continuer"}
        </Button>
      </div>
    </div>
  );
}
