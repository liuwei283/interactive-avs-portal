import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { isConfigured } from './lib/config';
import { AppLayout } from './components/layout/AppLayout';
import { RequireAuth } from './components/layout/RequireAuth';
import { Spinner } from './components/ui';
import LoginPage from './pages/LoginPage';
import SetupRequiredPage from './pages/SetupRequiredPage';
import OverviewPage from './pages/OverviewPage';
import SurveyPage from './pages/SurveyPage';
import PaperPage from './pages/PaperPage';
import DocumentsPage from './pages/DocumentsPage';
import DocumentPage from './pages/DocumentPage';
import WeeklyIndexPage from './pages/WeeklyIndexPage';
import WeeklyPage from './pages/WeeklyPage';
import ModelsPage from './pages/ModelsPage';
import ModelComponentPage from './pages/ModelComponentPage';
import ExperimentPage from './pages/ExperimentPage';
import NotFoundPage from './pages/NotFoundPage';

// The admin area is code-split; it only loads after login.
const AdminRoutes = lazy(() => import('./pages/admin/AdminRoutes'));

export default function App() {
  if (!isConfigured) return <SetupRequiredPage />;
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="survey" element={<SurveyPage />} />
        <Route path="survey/:slug" element={<PaperPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="documents/:slug" element={<DocumentPage />} />
        <Route path="progress" element={<WeeklyIndexPage />} />
        <Route path="progress/:weekStart" element={<WeeklyPage />} />
        <Route path="weekly/*" element={<Navigate to="/progress" replace />} />
        <Route path="models" element={<ModelsPage />} />
        <Route path="models/:slug" element={<ModelComponentPage />} />
        <Route path="experiments/:code" element={<ExperimentPage />} />
        <Route
          path="admin/*"
          element={
            <Suspense fallback={<Spinner />}>
              <AdminRoutes />
            </Suspense>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
