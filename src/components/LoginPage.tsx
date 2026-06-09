import { useState, forwardRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Mail, ArrowLeft } from "lucide-react";

const LoginPage = forwardRef<HTMLDivElement>(function LoginPage(_props, ref) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [resetSent, setResetSent] = useState(false);
  const [signupSent, setSignupSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Identifiants incorrects");
    }
    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError("Erreur lors de la connexion avec Google");
    }
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      if (error.message?.includes("weak_password") || (error as any)?.code === "weak_password") {
        setError("Ce mot de passe est trop courant et a été compromis. Choisissez-en un autre.");
      } else if (error.message?.includes("already registered") || error.message?.includes("already been registered")) {
        setError("Un compte avec cet email existe déjà. Connectez-vous.");
      } else {
        setError("Impossible de créer le compte. Vérifiez vos informations.");
      }
    } else {
      setSignupSent(true);
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      setError("Erreur lors de l'envoi de l'email");
    } else {
      setResetSent(true);
    }
    setLoading(false);
  };

  const switchMode = (newMode: "login" | "signup" | "forgot") => {
    setMode(newMode);
    setError(null);
    setResetSent(false);
    setSignupSent(false);
  };

  const getSubtitle = () => {
    if (mode === "login") return "Connexion requise";
    if (mode === "signup") return "Créer un compte";
    return "Réinitialisation du mot de passe";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="text-center space-y-1">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary flex items-center justify-center mb-2">
            <Lock className="w-6 h-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-xl">Holding NHA</CardTitle>
          <p className="text-sm text-muted-foreground">{getSubtitle()}</p>
        </CardHeader>
        <CardContent>
          {mode === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                  required
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="password"
                  placeholder="Mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9"
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive text-center">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Connexion…" : "Se connecter"}
              </Button>
              <div className="flex flex-col gap-1 items-center">
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Mot de passe oublié ?
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  Créer un compte
                </button>
              </div>
            </form>
          ) : mode === "signup" ? (
            signupSent ? (
              <div className="text-center space-y-3">
                <p className="text-sm">Un email de confirmation a été envoyé à <strong>{email}</strong>. Vérifiez votre boîte de réception.</p>
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-3 h-3" /> Retour à la connexion
                </button>
              </div>
            ) : (
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    required
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="Mot de passe (min. 6 caractères)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9"
                    required
                    minLength={6}
                  />
                </div>
                {error && <p className="text-sm text-destructive text-center">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Création…" : "Créer mon compte"}
                </Button>
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="inline-flex items-center gap-1 w-full justify-center text-sm text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  Déjà un compte ? Se connecter
                </button>
              </form>
            )
          ) : resetSent ? (
            <div className="text-center space-y-3">
              <p className="text-sm">Un email de réinitialisation a été envoyé à <strong>{email}</strong>.</p>
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-3 h-3" /> Retour à la connexion
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Votre email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive text-center">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Envoi…" : "Envoyer le lien"}
              </Button>
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="inline-flex items-center gap-1 w-full justify-center text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-3 h-3" /> Retour à la connexion
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
});

export default LoginPage;
