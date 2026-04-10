import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import LoginPage from "@/components/LoginPage";
import OnboardingForm from "@/components/OnboardingForm";
// import SetupPinPrompt from "@/components/SetupPinPrompt";
import LegalOnboarding from "@/components/LegalOnboarding";
import { Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { useEquipments } from "@/hooks/useEquipments";
import { useCleaningPlan } from "@/hooks/useCleaningPlan";
import { useEstablishmentName } from "@/hooks/useEstablishmentName";
import type { EstablishmentProfile } from "@/hooks/useEstablishmentName";
import { TableSkeleton } from "@/components/ui/loading-skeletons";

const Dashboard = lazy(() => import("@/components/dashboard/Dashboard"));
const DLCModule = lazy(() => import("@/components/haccp/DLCModule"));
const TemperaturesModule = lazy(() => import("@/components/haccp/TemperaturesModule"));
const CleaningModule = lazy(() => import("@/components/haccp/CleaningModule"));
const HACCPSettings = lazy(() => import("@/components/haccp/HACCPSettings"));
const HACCPReportModule = lazy(() => import("@/components/haccp/HACCPReportModule"));
const PlanningModule = lazy(() => import("@/components/equipe/PlanningModule"));
const TimeclockModule = lazy(() => import("@/components/equipe/TimeclockModule"));
const TeamSettings = lazy(() => import("@/components/equipe/TeamSettings"));
const MemosModule = lazy(() => import("@/components/equipe/MemosModule"));
const SubscriptionPage = lazy(() => import("@/pages/SubscriptionPage"));

function ModuleFallback() {
  return (
    <div className="space-y-4 p-4">
      <TableSkeleton rows={6} cols={5} />
    </div>
  );
}

function AuthenticatedApp({ userId, onSignOut }: { userId: string; onSignOut: () => void }) {
  const { equipments, addEquipment, updateEquipment, deleteEquipment } = useEquipments(userId);
  const { tasks: cleaningTasks, logs: cleaningLogs, loading: cleanLoading, error: cleanError, addTask: addCleaningTask, deleteTask: deleteCleaningTask, logDone: logCleaningDone, deleteLog: deleteCleaningLog, retry: cleanRetry } = useCleaningPlan(userId);
  const { establishmentName, profile, updateProfile, loading: profileLoading, refetch: refetchProfile } = useEstablishmentName(userId);

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!profile.onboarding_completed) {
    return (
      <OnboardingForm
        userId={userId}
        onComplete={async (data: Partial<EstablishmentProfile>) => {
          await updateProfile(data);
        }}
      />
    );
  }

  // PIN check disabled for now
  // if (!profile.has_manager_pin) {
  //   return <SetupPinPrompt userId={userId} onComplete={() => refetchProfile()} />;
  // }

  const needsLegal = !profile.cgu_accepted_at || !profile.cgv_accepted_at || !profile.privacy_policy_accepted_at;
  if (needsLegal) {
    return (
      <LegalOnboarding
        userId={userId}
        onComplete={() => {
          refetchProfile();
        }}
      />
    );
  }

  return (
    <AppLayout onSignOut={onSignOut} establishmentName={establishmentName}>
      <Suspense fallback={<ModuleFallback />}>
        <Routes>
          <Route path="/" element={<Dashboard userId={userId} />} />
          <Route path="/haccp/dlc" element={<DLCModule userId={userId} establishmentName={establishmentName} />} />
          <Route path="/haccp/temperatures" element={<TemperaturesModule userId={userId} equipmentsList={equipments} />} />
          <Route path="/haccp/nettoyage" element={<CleaningModule userId={userId} cleaningTasks={cleaningTasks} cleaningLogs={cleaningLogs} logCleaningDone={logCleaningDone} deleteCleaningLog={deleteCleaningLog} loading={cleanLoading} error={cleanError} onRetry={cleanRetry} />} />
          <Route path="/haccp/parametres" element={<HACCPSettings userId={userId} equipmentsList={equipments} addEquipment={addEquipment} updateEquipment={updateEquipment} deleteEquipment={deleteEquipment} cleaningTasks={cleaningTasks} addCleaningTask={addCleaningTask} deleteCleaningTask={deleteCleaningTask} />} />
          <Route path="/haccp/rapport" element={<HACCPReportModule userId={userId} establishmentName={establishmentName} profile={profile} />} />
          <Route path="/equipe/planning" element={<PlanningModule userId={userId} />} />
          <Route path="/equipe/pointeuse" element={<TimeclockModule userId={userId} />} />
          <Route path="/equipe/memos" element={<MemosModule userId={userId} />} />
          <Route path="/equipe/parametres" element={<TeamSettings userId={userId} onSignOut={onSignOut} />} />
          <Route path="/subscription" element={<SubscriptionPage subscriptionStatus={profile.subscription_status} userId={userId} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppLayout>
  );
}

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

  return <AuthenticatedApp userId={session.user.id} onSignOut={signOut} />;
};

export default Index;
