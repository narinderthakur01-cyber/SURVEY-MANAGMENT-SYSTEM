import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { SupervisorDashboard } from './pages/supervisor/SupervisorDashboard';
import { SurveyListPage } from './pages/admin/SurveyListPage';
import { SurveyBuilderPage } from './pages/admin/SurveyBuilderPage';
import { AdminTaskManagementPage } from './pages/admin/AdminTaskManagementPage';
import { LiveTrackingPage } from './pages/admin/LiveTrackingPage';
import { WorkerTaskDashboard } from './pages/worker/WorkerTaskDashboard';
import { TaskExecutionPage } from './pages/worker/TaskExecutionPage';
import { PublicSurveyPage } from './pages/public/PublicSurveyPage';
import { UnauthorizedPage } from './pages/UnauthorizedPage';
import { Loader2 } from 'lucide-react';

// Dynamic redirect component based on user role
const RootRedirect: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-sky-600 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  switch (user.role?.name) {
    case 'ADMIN':
      return <Navigate to="/admin" replace />;
    case 'SUPERVISOR':
      return <Navigate to="/supervisor" replace />;
    case 'WORKER':
      return <Navigate to="/worker" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
};

export default function App() {
  const { initAuth } = useAuthStore();

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Login Route */}
        <Route path="/login" element={<LoginPage />} />

        {/* Public Respondent Survey Route */}
        <Route path="/s/:slug" element={<PublicSurveyPage />} />

        {/* Surveys List Route (Admin & Supervisor) */}
        <Route
          path="/admin/surveys"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'SUPERVISOR']}>
              <Layout>
                <SurveyListPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Survey Builder Route (Admin Only) */}
        <Route
          path="/admin/surveys/:surveyId/builder"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <Layout>
                <SurveyBuilderPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Tasks Management Route (Admin & Supervisor) */}
        <Route
          path="/admin/tasks"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'SUPERVISOR']}>
              <Layout>
                <AdminTaskManagementPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/supervisor/tasks"
          element={
            <ProtectedRoute allowedRoles={['SUPERVISOR', 'ADMIN']}>
              <Layout>
                <AdminTaskManagementPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Live Tracking Map (Admin & Supervisor) */}
        <Route
          path="/admin/tracking"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'SUPERVISOR']}>
              <Layout>
                <LiveTrackingPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/supervisor/tracking"
          element={
            <ProtectedRoute allowedRoles={['SUPERVISOR', 'ADMIN']}>
              <Layout>
                <LiveTrackingPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Worker Tasks Portal & Survey Execution */}
        <Route
          path="/worker/tasks"
          element={
            <ProtectedRoute allowedRoles={['WORKER', 'SUPERVISOR', 'ADMIN']}>
              <Layout>
                <WorkerTaskDashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/worker/tasks/:taskId/execute"
          element={
            <ProtectedRoute allowedRoles={['WORKER', 'SUPERVISOR', 'ADMIN']}>
              <Layout>
                <TaskExecutionPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Admin Portal */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <Layout>
                <AdminDashboard />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Supervisor Portal */}
        <Route
          path="/supervisor"
          element={
            <ProtectedRoute allowedRoles={['SUPERVISOR', 'ADMIN']}>
              <Layout>
                <SupervisorDashboard />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Worker Portal */}
        <Route
          path="/worker"
          element={
            <ProtectedRoute allowedRoles={['WORKER', 'SUPERVISOR', 'ADMIN']}>
              <Layout>
                <WorkerTaskDashboard />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Access Denied Route */}
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        {/* Root and Fallback Routes */}
        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
