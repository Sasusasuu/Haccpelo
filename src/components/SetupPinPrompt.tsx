import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Lock } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { hashPinRemote } from "@/lib/pinUtils";
import { supabase } from "@/integrations/supabase/client";
import LogoutButton from "@/components/LogoutButton";

interface SetupPinPromptProps {
  userId: string;
  onComplete: () => void;
  onSignOut: () => void;
}

export default function SetupPinPrompt({ userId, onComplete, onSignOut }: SetupPinPromptProps) {
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (!/^\d{4}$/.test(pin)) {
      setError("Le code PIN doit contenir exactement 4 chiffres.");
      return;
    }
    if (pin !== pinConfirm) {
      setError("Les codes PIN ne correspondent pas.");
      return;
    }
    setSaving(true);
    try {
      const hash = await hashPinRemote(pin);
      const { error: dbError } = await supabase
        .from("settings")
        .update({ manager_pin_hash: hash, manager_pin_configured: true } as any)
        .eq("user_id", userId);
      if (dbError) throw dbError;
      onComplete();
    } catch {
      setError("Impossible d'enregistrer le code PIN. Réessayez.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md flex justify-end mb-2">
        <LogoutButton onSignOut={onSignOut} />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-xl">Définir votre code PIN Manager</CardTitle>
          <p className="text-sm text-muted-foreground">
            Votre code PIN a été réinitialisé. Veuillez en créer un nouveau pour sécuriser l'accès aux fonctions sensibles.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm">Nouveau code PIN (4 chiffres)</Label>
            <InputOTP maxLength={4} value={pin} onChange={setPin}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Confirmer le code PIN</Label>
            <InputOTP maxLength={4} value={pinConfirm} onChange={setPinConfirm}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="w-full" onClick={handleSubmit} disabled={saving}>
            {saving ? "Enregistrement..." : "Valider le code PIN"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
