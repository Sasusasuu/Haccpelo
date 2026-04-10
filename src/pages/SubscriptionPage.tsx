import { CheckCircle2, Circle, Star, CreditCard, Rocket } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

interface Feature {
  label: string;
  included: boolean;
}

interface Plan {
  key: string;
  title: string;
  price: string;
  priceLabel: string;
  description: string;
  recommended: boolean;
  disabled: boolean;
  monthlyNumeric?: number;
  features: Feature[];
}

interface Plan {
  key: string;
  title: string;
  price: string;
  priceLabel: string;
  description: string;
  recommended: boolean;
  disabled: boolean;
  features: Feature[];
}

const plans: Plan[] = [
  {
    key: "starter",
    title: "Starter",
    price: "29€",
    priceLabel: "/mois",
    description: "L'essentiel pour gérer votre hygiène et votre équipe au quotidien.",
    recommended: false,
    disabled: false,
    monthlyNumeric: 29,
    features: [
      { label: "Lorem ipsum dolor sit amet", included: true },
      { label: "Consectetur adipiscing elit", included: true },
      { label: "Sed do eiusmod tempor", included: true },
      { label: "Ut enim ad minim veniam", included: true },
      { label: "Quis nostrud exercitation", included: true },
      { label: "Duis aute irure dolor", included: false },
      { label: "Excepteur sint occaecat", included: false },
      { label: "Cupidatat non proident", included: false },
    ],
  },
  {
    key: "pro",
    title: "Pro",
    price: "890€",
    priceLabel: "/mois",
    description: "Toute la puissance de l'IA et des rapports automatisés pour gagner du temps.",
    recommended: true,
    disabled: false,
    monthlyNumeric: 890,
    features: [
      { label: "Lorem ipsum dolor sit amet", included: true },
      { label: "Consectetur adipiscing elit", included: true },
      { label: "Sed do eiusmod tempor", included: true },
      { label: "Ut enim ad minim veniam", included: true },
      { label: "Quis nostrud exercitation", included: true },
      { label: "Duis aute irure dolor", included: true },
      { label: "Excepteur sint occaecat", included: true },
      { label: "Cupidatat non proident", included: true },
    ],
  },
];

interface SubscriptionPageProps {
  subscriptionStatus: string;
  userId: string;
}

function getButtonConfig(planKey: string, currentStatus: string) {
  if (planKey === "enterprise") {
    return { label: "Bientôt disponible", disabled: true, variant: "outline" as const };
  }
  if (planKey === currentStatus) {
    return { label: "Votre plan actuel", disabled: true, variant: "secondary" as const };
  }
  if (planKey === "pro" && currentStatus === "starter") {
    return { label: "Passer au plan Pro", disabled: false, variant: "default" as const };
  }
  if (planKey === "starter" && currentStatus === "pro") {
    return { label: "Rétrograder vers Starter", disabled: false, variant: "destructive" as const };
  }
  return { label: `Choisir ${planKey}`, disabled: false, variant: "outline" as const };
}

export default function SubscriptionPage({ subscriptionStatus, userId }: SubscriptionPageProps) {
  const status = subscriptionStatus || "starter";

  const handleChoose = (planTitle: string) => {
    toast("Connexion à l'environnement de test Stripe en cours...", {
      description: `Plan sélectionné : ${planTitle}`,
    });
  };

  return (
    <div className="max-w-5xl mx-auto py-10 px-4">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 mb-3">
          <CreditCard className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Choisissez le plan adapté à votre établissement</h1>
        </div>
        <p className="text-muted-foreground text-lg mt-2">
          Des outils pensés pour simplifier votre quotidien en restauration.
        </p>
      </div>

      {/* Status banner */}
      <Alert className={`mb-8 ${status === "pro" ? "border-primary bg-primary/5" : "border-muted"}`}>
        <AlertDescription className="flex items-center gap-2 text-base">
          {status === "pro" ? (
            <>
              <Rocket className="h-5 w-5 text-primary shrink-0" />
              <span><strong>Votre forfait actuel : Pro.</strong> Vous bénéficiez de toutes les fonctionnalités premium.</span>
            </>
          ) : (
            <>
              <Star className="h-5 w-5 text-yellow-500 shrink-0" />
              <span><strong>Votre forfait actuel : Starter.</strong> Passez au plan Pro pour débloquer l'IA et les exports automatisés.</span>
            </>
          )}
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        {plans.map((plan) => {
          const btn = getButtonConfig(plan.key, status);
          const isCurrent = plan.key === status;

          return (
            <Card
              key={plan.key}
              className={`flex flex-col relative ${
                plan.recommended ? "border-primary border-2 shadow-lg" : ""
              } ${isCurrent ? "ring-2 ring-primary/30" : ""} ${plan.disabled ? "opacity-60" : ""}`}
            >
              {plan.recommended && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 gap-1">
                  <Star className="h-3 w-3" /> Recommandé
                </Badge>
              )}
              {isCurrent && !plan.recommended && (
                <Badge variant="secondary" className="absolute -top-3 left-1/2 -translate-x-1/2">
                  Plan actuel
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
                {plan.monthlyNumeric && (
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="font-semibold text-primary">-10%</span> si payé annuellement.{" "}
                    Soit <span className="font-semibold">{Math.round(plan.monthlyNumeric * 0.9 * 12)}€</span>/an au lieu de <span className="line-through">{plan.monthlyNumeric * 12}€</span>
                  </p>
                )}
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
                  variant={btn.variant}
                  disabled={btn.disabled}
                  onClick={() => handleChoose(plan.title)}
                >
                  {btn.label}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
