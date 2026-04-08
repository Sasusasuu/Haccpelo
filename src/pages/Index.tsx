import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import LoginPage from "@/components/LoginPage";
import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "@/components/dashboard/Dashboard";
import DLCModule from "@/components/haccp/DLCModule";
import TemperaturesModule from "@/components/haccp/TemperaturesModule";
import CleaningModule from "@/components/haccp/CleaningModule";
import HACCPSettings from "@/components/haccp/HACCPSettings";
import PlanningModule from "@/components/equipe/PlanningModule";
import TimeclockModule from "@/components/equipe/TimeclockModule";
import TeamSettings from "@/components/equipe/TeamSettings";
import MemosModule from "@/components/equipe/MemosModule";
import { useEquipments } from "@/hooks/useEquipments";
import { useCleaningPlan } from "@/hooks/useCleaningPlan";

function AuthenticatedApp({ userId, onSignOut }: { userId: string; onSignOut: () => void }) {
  const { equipments, addEquipment, updateEquipment, deleteEquipment } = useEquipments(userId);
  const { tasks: cleaningTasks, logs: cleaningLogs, loading: cleanLoading, error: cleanError, addTask: addCleaningTask, deleteTask: deleteCleaningTask, logDone: logCleaningDone, deleteLog: deleteCleaningLog, retry: cleanRetry } = useCleaningPlan(userId);

  return (
    <AppLayout onSignOut={onSignOut}>
      <Routes>
        <Route path="/" element={<Dashboard userId={userId} />} />
        <Route path="/haccp/dlc" element={<DLCModule userId={userId} />} />
        <Route path="/haccp/temperatures" element={<TemperaturesModule userId={userId} equipmentsList={equipments} />} />
        <Route path="/haccp/nettoyage" element={<CleaningModule userId={userId} cleaningTasks={cleaningTasks} cleaningLogs={cleaningLogs} logCleaningDone={logCleaningDone} deleteCleaningLog={deleteCleaningLog} loading={cleanLoading} error={cleanError} onRetry={cleanRetry} />} />
        <Route path="/haccp/parametres" element={<HACCPSettings userId={userId} equipmentsList={equipments} addEquipment={addEquipment} updateEquipment={updateEquipment} deleteEquipment={deleteEquipment} cleaningTasks={cleaningTasks} addCleaningTask={addCleaningTask} deleteCleaningTask={deleteCleaningTask} />} />
        <Route path="/equipe/planning" element={<PlanningModule userId={userId} />} />
        <Route path="/equipe/pointeuse" element={<TimeclockModule userId={userId} />} />
        <Route path="/equipe/memos" element={<MemosModule userId={userId} />} />
        <Route path="/equipe/parametres" element={<TeamSettings userId={userId} onSignOut={onSignOut} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
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
