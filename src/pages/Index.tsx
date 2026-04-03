import { useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AppLayout } from "@/components/AppLayout";
import LoginPage from "@/components/LoginPage";
import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "@/components/dashboard/Dashboard";
import DLCModule from "@/components/haccp/DLCModule";
import TemperaturesModule from "@/components/haccp/TemperaturesModule";
import NettoyageModule from "@/components/haccp/NettoyageModule";
import HACCPParametres from "@/components/haccp/HACCPParametres";
import PlanningModule from "@/components/equipe/PlanningModule";
import PointeuseModule from "@/components/equipe/PointeuseModule";
import EquipeParametres from "@/components/equipe/EquipeParametres";
import { useEquipments } from "@/hooks/useEquipments";
import { useCleaningPlan } from "@/hooks/useCleaningPlan";

function AuthenticatedApp({ userId, onSignOut }: { userId: string; onSignOut: () => void }) {
  const { equipments, addEquipment, updateEquipment, deleteEquipment } = useEquipments(userId);
  const { tasks: cleaningTasks, logs: cleaningLogs, addTask: addCleaningTask, deleteTask: deleteCleaningTask, logDone: logCleaningDone, deleteLog: deleteCleaningLog } = useCleaningPlan(userId);

  return (
    <AppLayout onSignOut={onSignOut}>
      <Routes>
        <Route path="/" element={<Dashboard userId={userId} />} />
        <Route path="/haccp/dlc" element={<DLCModule userId={userId} />} />
        <Route path="/haccp/temperatures" element={<TemperaturesModule userId={userId} equipmentsList={equipments} />} />
        <Route path="/haccp/nettoyage" element={<NettoyageModule userId={userId} cleaningTasks={cleaningTasks} cleaningLogs={cleaningLogs} logCleaningDone={logCleaningDone} deleteCleaningLog={deleteCleaningLog} />} />
        <Route path="/haccp/parametres" element={<HACCPParametres userId={userId} equipmentsList={equipments} addEquipment={addEquipment} updateEquipment={updateEquipment} deleteEquipment={deleteEquipment} cleaningTasks={cleaningTasks} addCleaningTask={addCleaningTask} deleteCleaningTask={deleteCleaningTask} />} />
        <Route path="/equipe/planning" element={<PlanningModule userId={userId} />} />
        <Route path="/equipe/pointeuse" element={<PointeuseModule userId={userId} />} />
        <Route path="/equipe/parametres" element={<EquipeParametres userId={userId} onSignOut={onSignOut} />} />
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
