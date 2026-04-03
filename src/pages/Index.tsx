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

  return <AppBureau onSignOut={signOut} userId={session.user.id} />;
};

export default Index;
