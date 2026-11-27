import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Activity, LogOut, User as UserIcon, Shield, Users, ClipboardCheck, FileText, ClipboardList, Navigation } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getRoleBadge = (roleName?: string) => {
    switch (roleName) {
      case 'ADMIN':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'SUPERVISOR':
        return 'bg-sky-100 text-sky-800 border-sky-200';
      case 'WORKER':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getDashboardLink = () => {
    switch (user?.role?.name) {
      case 'ADMIN':
        return '/admin';
      case 'SUPERVISOR':
        return '/supervisor';
      case 'WORKER':
        return '/worker';
      default:
        return '/login';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Brand */}
            <div className="flex items-center space-x-3">
              <Link to={getDashboardLink()} className="flex items-center space-x-3 group">
                <div className="p-2 bg-sky-600 rounded-lg text-white group-hover:bg-sky-700 transition-colors">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-slate-900 text-base block leading-none">
                    SurveyTrack
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">Field Workforce System</span>
                </div>
              </Link>
            </div>

            {/* Navigation Links based on role */}
            <nav className="hidden md:flex items-center space-x-1">
              <Link
                to={getDashboardLink()}
                className="px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:text-sky-600 hover:bg-slate-50 transition-colors"
              >
                Dashboard
              </Link>

              {(user?.role?.name === 'ADMIN' || user?.role?.name === 'SUPERVISOR') && (
                <>
                  <Link
                    to="/admin/surveys"
                    className="px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:text-sky-600 hover:bg-slate-50 transition-colors flex items-center"
                  >
                    <FileText className="w-4 h-4 mr-1.5" />
                    Surveys
                  </Link>
                  <Link
                    to="/admin/tasks"
                    className="px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:text-sky-600 hover:bg-slate-50 transition-colors flex items-center"
                  >
                    <ClipboardList className="w-4 h-4 mr-1.5" />
                    Tasks
                  </Link>
                  <Link
                    to={user?.role?.name === 'ADMIN' ? '/admin/tracking' : '/supervisor/tracking'}
                    className="px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:text-sky-600 hover:bg-slate-50 transition-colors flex items-center"
                  >
                    <Navigation className="w-4 h-4 mr-1.5 text-sky-600" />
                    Live Tracking
                  </Link>
                </>
              )}

              {user?.role?.name === 'ADMIN' && (
                <>
                  <Link
                    to="/admin"
                    className="px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:text-sky-600 hover:bg-slate-50 transition-colors flex items-center"
                  >
                    <Users className="w-4 h-4 mr-1.5" />
                    Users
                  </Link>
                  <Link
                    to="/admin"
                    className="px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:text-sky-600 hover:bg-slate-50 transition-colors flex items-center"
                  >
                    <Shield className="w-4 h-4 mr-1.5" />
                    Teams
                  </Link>
                </>
              )}

              {user?.role?.name === 'SUPERVISOR' && (
                <span className="px-3 py-2 rounded-md text-sm font-medium text-slate-400 cursor-not-allowed flex items-center">
                  <Users className="w-4 h-4 mr-1.5" />
                  My Teams
                </span>
              )}

              {user?.role?.name === 'WORKER' && (
                <Link
                  to="/worker/tasks"
                  className="px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:text-sky-600 hover:bg-slate-50 transition-colors flex items-center"
                >
                  <ClipboardCheck className="w-4 h-4 mr-1.5" />
                  My Tasks
                </Link>
              )}
            </nav>

            {/* User Profile & Logout */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
                <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-slate-600">
                  <UserIcon className="w-4 h-4" />
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-semibold text-slate-900 leading-none">
                    {user?.full_name || 'User'}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate max-w-[140px] mt-0.5">
                    {user?.email}
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${getRoleBadge(
                    user?.role?.name
                  )}`}
                >
                  {user?.role?.name}
                </span>
              </div>

              <button
                onClick={handleLogout}
                className="inline-flex items-center px-3 py-1.5 border border-slate-200 text-xs font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-100 hover:text-rose-600 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500"
                title="Log out of your account"
              >
                <LogOut className="w-3.5 h-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-500">
          Survey Management & Live Field Workforce Tracking System &bull; Phase 2 Frontend Architecture
        </div>
      </footer>
    </div>
  );
};
