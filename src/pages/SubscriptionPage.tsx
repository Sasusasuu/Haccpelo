import { CheckCircle2, Circle, Star, CreditCard } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const plans = [
  {
    title: "Starter",
    price: "29€",
    priceLabel: "/mois",
    description: "L'essentiel pour gérer votre hygiène et votre équipe au quotidien.",
    recommended: false,
    disabled: false,
    features: [
      { label: "Gestion DLC (manuelle)", included: true },
      { label: "Relevés de Températures", included: true },
      { label: "Plan de Nettoyage", included: true },
      { label: "Planning Hebdomadaire", included: true },
      { label: "Pointeuse par Code PIN", included: true },
      { label: "Outils IA (Scan & suggestion DLC)", included: false },
      { label: "Rapport Mensuel HACCP (PDF)", included: false },
      { label: "Pointeuse par Badge NFC", included: false },
    ],
  },
  {
    title: "Pro",
    price: "59€",
    priceLabel: "/mois",
    description: "Toute la puissance de l'IA et des rapports automatisés pour gagner du temps.",
    recommended: true,
    disabled: false,
    features: [
      { label: "Gestion DLC (manuelle)", included: true },
      { label: "Relevés de Températures", included: true },
      { label: "Plan de Nettoyage", included: true },
      { label: "Planning Hebdomadaire", included: true },
      { label: "Pointeuse par Code PIN", included: true },
      { label: "Outils IA (Scan & suggestion DLC)", included: true },
      { label: "Rapport Mensuel HACCP (PDF)", included: true },
      { label: "Pointeuse par Badge NFC", included: true },
    ],
  },
  {
    title: "Sur Mesure",
    price: "Sur devis",
    priceLabel: "",
    description: "Multisites, intégration ERP, support dédié...",
    recommended: false,
    disabled: true,
    features: [
      { label: "Tout le plan Pro inclus", included: true },
      { label: "Gestion multisites", included: true },
      { label: "Intégration ERP", included: true },
      { label: "Support prioritaire dédié", included: true },
      { label: "Formation sur site", included: true },
    ],
  },
];

export default function SubscriptionPage() {
  const handleChoose = (planTitle: string) => {
    toast("Connexion à l'environnement de test Stripe en cours...", {
      description: `Plan sélectionné : ${planTitle}`,
    });
  };

  return (
    <div className="max-w-5xl mx-auto py-10 px-4">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 mb-3">
          <CreditCard className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Choisissez le plan adapté à votre établissement</h1>
        </div>
        <p className="text-muted-foreground text-lg mt-2">
          Des outils pensés pour simplifier votre quotidien en restauration.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <Card
            key={plan.title}
            className={`flex flex-col relative ${
              plan.recommended ? "border-primary border-2 shadow-lg" : ""
            } ${plan.disabled ? "opacity-60" : ""}`}
          >
            {plan.recommended && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 gap-1">
                <Star className="h-3 w-3" /> Recommandé
              </Badge>
            )}

            <CardHeader className="text-center pb-2">
              <CardTitle className="text-xl">{plan.title}</CardTitle>
              <div className="mt-2">
                <span className="text-3xl font-extrabold">{plan.price}</span>
                {plan.priceLabel && (
                  <span className="text-muted-foreground text-sm">{plan.priceLabel}</span>
                )}
              </div>
              <CardDescription className="mt-2">{plan.description}</CardDescription>
            </CardHeader>

            <CardContent className="flex-1">
              <ul className="space-y-3">
                {plan.features.map((f) => (
                  <li key={f.label} className="flex items-center gap-2 text-sm">
                    {f.included ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className={f.included ? "" : "text-muted-foreground"}>
                      {f.label}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>

            <CardFooter>
              <Button
                className="w-full"
                variant={plan.recommended ? "default" : "outline"}
                disabled={plan.disabled}
                onClick={() => handleChoose(plan.title)}
              >
                {plan.disabled ? "Bientôt disponible" : `Choisir ${plan.title}`}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
