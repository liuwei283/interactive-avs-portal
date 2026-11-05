import { NavLink, Route, Routes } from 'react-router-dom';
import AdminHome from './AdminHome';
import WeeklyAdmin, { WeeklyEditor, WeeklyNew } from './WeeklyAdmin';
import ExperimentsAdmin, { ExperimentEditor } from './ExperimentsAdmin';
import ModelsAdmin, { ModelEditor } from './ModelsAdmin';
import DocumentsAdmin, { DocumentEditor } from './DocumentsAdmin';
import PapersAdmin, { PaperEditor } from './PapersAdmin';
import AssetsAdmin from './AssetsAdmin';
import OverviewAdmin from './OverviewAdmin';
import MilestonesAdmin from './MilestonesAdmin';
import NotFoundPage from '../NotFoundPage';
import { useTitle } from '../../lib/useTitle';

const LINKS = [
  ['/admin', 'Dashboard', true],
  ['/admin/weekly', 'Weekly updates', false],
  ['/admin/experiments', 'Experiments', false],
  ['/admin/models', 'Model components', false],
  ['/admin/documents', 'Documents', false],
  ['/admin/papers', 'Survey papers', false],
  ['/admin/assets', 'Files & demo assets', false],
  ['/admin/overview', 'Overview & thrusts', false],
  ['/admin/milestones', 'Milestones', false],
] as const;

export default function AdminRoutes() {
  useTitle('Admin');
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[12rem_1fr]">
      <nav aria-label="Admin" className="lg:sticky lg:top-20 lg:self-start">
        <div className="eyebrow mb-2">Admin</div>
        <ul className="flex flex-wrap gap-1 lg:block lg:space-y-0.5">
          {LINKS.map(([to, label, end]) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) => `block rounded px-2 py-1.5 text-sm ${isActive ? 'bg-accent-50 font-medium text-accent-800' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0">
        <Routes>
          <Route index element={<AdminHome />} />
          <Route path="weekly" element={<WeeklyAdmin />} />
          <Route path="weekly/new" element={<WeeklyNew />} />
          <Route path="weekly/:id" element={<WeeklyEditor />} />
          <Route path="experiments" element={<ExperimentsAdmin />} />
          <Route path="experiments/:id" element={<ExperimentEditor />} />
          <Route path="models" element={<ModelsAdmin />} />
          <Route path="models/:id" element={<ModelEditor />} />
          <Route path="documents" element={<DocumentsAdmin />} />
          <Route path="documents/:id" element={<DocumentEditor />} />
          <Route path="papers" element={<PapersAdmin />} />
          <Route path="papers/:id" element={<PaperEditor />} />
          <Route path="assets" element={<AssetsAdmin />} />
          <Route path="overview" element={<OverviewAdmin />} />
          <Route path="milestones" element={<MilestonesAdmin />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
    </div>
  );
}
