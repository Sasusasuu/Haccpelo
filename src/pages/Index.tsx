import { useAuth } from "@/hooks/useAuth";
import AppBureau from "@/components/AppBureau";
import LoginPage from "@/components/LoginPage";

const Index = () => {
  const { session, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  return (
    <div>
      <div className="fixed top-2 right-2 z-50">
        <button
          onClick={signOut}
          className="text-xs px-3 py-1.5 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
        >
          Déconnexion
        </button>
      </div>
      <AppBureau />
    </div>
  );
};

export default Index;
