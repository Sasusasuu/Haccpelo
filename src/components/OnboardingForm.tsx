import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Lock } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { hashPinRemote } from "@/lib/pinUtils";
import { supabase } from "@/integrations/supabase/client";
import type { EstablishmentProfile } from "@/hooks/useEstablishmentName";

interface OnboardingFormProps {
  userId: string;
  onComplete: (data: Partial<EstablishmentProfile>) => Promise<void>;
}

export default function OnboardingForm({ userId, onComplete }: OnboardingFormProps) {
  const [form, setForm] = useState({
    establishment_name: "",
    siret: "",
    email: "",
    phone: "",
    address: "",
    postal_code: "",
    city: "",
    manager_name: "",
  });
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.establishment_name.trim()) e.establishment_name = "Requis";
    if (!form.manager_name.trim()) e.manager_name = "Requis";
    if (form.siret && !/^\d{14}$/.test(form.siret.replace(/\s/g, ""))) e.siret = "Le SIRET doit contenir 14 chiffres";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Email invalide";
    if (form.phone && !/^[\d\s+()-]{6,20}$/.test(form.phone)) e.phone = "Numéro invalide";
    if (form.postal_code && !/^\d{5}$/.test(form.postal_code)) e.postal_code = "Code postal à 5 chiffres";
    if (!/^\d{4}$/.test(pin)) e.pin = "Le code PIN doit contenir exactement 4 chiffres";
    if (pin !== pinConfirm) e.pinConfirm = "Les codes PIN ne correspondent pas";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      // Hash the manager PIN
      const pinHash = await hashPinRemote(pin);

      // Save PIN hash to settings
      await supabase
        .from("settings")
        .update({ manager_pin_hash: pinHash })
        .eq("user_id", userId);

      await onComplete({
        ...form,
        establishment_name: form.establishment_name.trim(),
        siret: form.siret.replace(/\s/g, ""),
        manager_name: form.manager_name.trim(),
        onboarding_completed: true,
      });
    } finally {
      setSaving(false);
    }
  };

  const set = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-xl">Configuration de votre établissement</CardTitle>
          <p className="text-sm text-muted-foreground">
            Ces informations apparaîtront sur vos rapports HACCP et exports.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Nom de l'établissement *</Label>
              <Input value={form.establishment_name} onChange={e => set("establishment_name", e.target.value)} placeholder="Ex: Restaurant Le Bon Goût" />
              {errors.establishment_name && <p className="text-xs text-destructive">{errors.establishment_name}</p>}
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Nom du responsable / gérant *</Label>
              <Input value={form.manager_name} onChange={e => set("manager_name", e.target.value)} placeholder="Ex: Jean Dupont" />
              {errors.manager_name && <p className="text-xs text-destructive">{errors.manager_name}</p>}
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>N° SIRET</Label>
              <Input value={form.siret} onChange={e => set("siret", e.target.value)} placeholder="123 456 789 01234" maxLength={17} />
              {errors.siret && <p className="text-xs text-destructive">{errors.siret}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="contact@restaurant.fr" />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Téléphone</Label>
              <Input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="01 23 45 67 89" />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Adresse</Label>
              <Input value={form.address} onChange={e => set("address", e.target.value)} placeholder="12 rue de la Paix" />
            </div>
            <div className="space-y-1.5">
              <Label>Code postal</Label>
              <Input value={form.postal_code} onChange={e => set("postal_code", e.target.value)} placeholder="75001" maxLength={5} />
              {errors.postal_code && <p className="text-xs text-destructive">{errors.postal_code}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Ville</Label>
              <Input value={form.city} onChange={e => set("city", e.target.value)} placeholder="Paris" />
            </div>
          </div>

          {/* Manager PIN Section */}
          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary" />
              <Label className="text-base font-semibold">Code PIN Manager *</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Ce code à 4 chiffres protégera l'accès aux paramètres, rapports et modifications sensibles.
            </p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Code PIN</Label>
                <InputOTP maxLength={4} value={pin} onChange={(v) => { setPin(v); if (errors.pin) setErrors(prev => { const n = { ...prev }; delete n.pin; return n; }); }}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                  </InputOTPGroup>
                </InputOTP>
                {errors.pin && <p className="text-xs text-destructive">{errors.pin}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Confirmer le code PIN</Label>
                <InputOTP maxLength={4} value={pinConfirm} onChange={(v) => { setPinConfirm(v); if (errors.pinConfirm) setErrors(prev => { const n = { ...prev }; delete n.pinConfirm; return n; }); }}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                  </InputOTPGroup>
                </InputOTP>
                {errors.pinConfirm && <p className="text-xs text-destructive">{errors.pinConfirm}</p>}
              </div>
            </div>
          </div>

          <Button className="w-full" onClick={handleSubmit} disabled={saving}>
            {saving ? "Enregistrement..." : "Commencer à utiliser l'application"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
