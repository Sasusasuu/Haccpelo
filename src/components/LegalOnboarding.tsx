import { useState, useRef, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CGU_TEXT, CGV_TEXT, PRIVACY_TEXT, LEGAL_VERSION } from "@/constants/legalTexts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LegalOnboardingProps {
  userId: string;
  onComplete: () => void;
}

function useScrollDetection() {
  const [hasRead, setHasRead] = useState(false);
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    // Consider "read" when scrolled within 30px of bottom
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 30) {
      setHasRead(true);
    }
  }, []);
  return { hasRead, handleScroll };
}

function LegalTextPanel({
  text,
  onScroll,
}: {
  text: string;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      className="h-[50vh] overflow-y-auto border rounded-md p-4 bg-muted/30 text-sm leading-relaxed whitespace-pre-line"
      onScroll={onScroll}
    >
      {text}
    </div>
  );
}

export default function LegalOnboarding({ userId, onComplete }: LegalOnboardingProps) {
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
      const { error } = await supabase
        .from("settings")
        .update({
          cgu_accepted_at: now,
          cgv_accepted_at: now,
          privacy_policy_accepted_at: now,
          legal_documents_version: LEGAL_VERSION,
        } as any)
        .eq("user_id", userId);
      if (error) throw error;
      toast.success("Documents légaux acceptés.");
      onComplete();
    } catch {
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
            <LegalTextPanel text={CGU_TEXT} onScroll={cgu.handleScroll} />
          </TabsContent>
          <TabsContent value="cgv">
            <LegalTextPanel text={CGV_TEXT} onScroll={cgv.handleScroll} />
          </TabsContent>
          <TabsContent value="privacy">
            <LegalTextPanel text={PRIVACY_TEXT} onScroll={privacy.handleScroll} />
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
