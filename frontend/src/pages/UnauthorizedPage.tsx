import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export const UnauthorizedPage: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const handleReturn = () => {
    switch (user?.role?.name) {
      case 'ADMIN':
        navigate('/admin');
        break;
      case 'SUPERVISOR':
        navigate('/supervisor');
        break;
      case 'WORKER':
        navigate('/worker');
        break;
      default:
        navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4">
      <div className="max-w-md w-full bg-white p-8 rounded-xl border border-slate-200 shadow-sm text-center">
        <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Access Denied (403)</h1>
        <p className="text-xs text-slate-500 mb-6">
          Your account role (<span className="font-semibold text-slate-700">{user?.role?.name || 'UNKNOWN'}</span>) does not have authorization to access this administrative portal.
        </p>
        <button
          onClick={handleReturn}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Return to My Dashboard
        </button>
      </div>
    </div>
  );
};
