import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '../store/authStore';
import { Activity, Lock, Mail, AlertCircle, Loader2, ArrowRight } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address').min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const { login, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setAuthError(null);
    clearError();
    try {
      const user = await login(data.email, data.password);
      // Navigate to destination or role dashboard
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname;
      if (from && from !== '/login') {
        navigate(from, { replace: true });
      } else {
        switch (user.role?.name) {
          case 'ADMIN':
            navigate('/admin', { replace: true });
            break;
          case 'SUPERVISOR':
            navigate('/supervisor', { replace: true });
            break;
          case 'WORKER':
            navigate('/worker', { replace: true });
            break;
          default:
            navigate('/', { replace: true });
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid login credentials';
      setAuthError(msg);
    }
  };

  const setCredentials = (email: string, pass: string) => {
    setValue('email', email);
    setValue('password', pass);
    setAuthError(null);
    clearError();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="p-3 bg-sky-600 rounded-xl text-white shadow-md">
            <Activity className="w-8 h-8" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-slate-900">
          Sign in to your account
        </h2>
        <p className="mt-1 text-center text-xs text-slate-500">
          Survey Management & Live Field Workforce Tracking
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-xl sm:px-10">
          {(authError || error) && (
            <div className="mb-6 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Authentication Failed</p>
                <p className="mt-0.5">{authError || error}</p>
              </div>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-slate-700">
                Email Address
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...register('email')}
                  className={`block w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                    errors.email
                      ? 'border-rose-300 focus:ring-rose-500 focus:border-rose-500'
                      : 'border-slate-300 focus:ring-sky-500 focus:border-sky-500'
                  }`}
                  placeholder="name@survey.org"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-rose-600">{errors.email.message}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-xs font-medium text-slate-700">
                Password
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  {...register('password')}
                  className={`block w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                    errors.password
                      ? 'border-rose-300 focus:ring-rose-500 focus:border-rose-500'
                      : 'border-slate-300 focus:ring-sky-500 focus:border-sky-500'
                  }`}
                  placeholder="••••••••••••"
                />
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-rose-600">{errors.password.message}</p>
              )}
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50 transition-colors"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Quick Credential Helper for Demonstration & Testing */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 text-center">
              Quick Test Credentials
            </p>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setCredentials('admin@survey.org', 'ChangeThisPassword123!')}
                className="w-full text-left px-2.5 py-1.5 rounded text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 flex justify-between items-center transition-colors"
              >
                <span className="font-semibold text-purple-700">Administrator:</span>
                <span className="text-slate-500">admin@survey.org</span>
              </button>
              <button
                type="button"
                onClick={() => setCredentials('supervisor@survey.org', 'Supervisor123!')}
                className="w-full text-left px-2.5 py-1.5 rounded text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 flex justify-between items-center transition-colors"
              >
                <span className="font-semibold text-sky-700">Supervisor:</span>
                <span className="text-slate-500">supervisor@survey.org</span>
              </button>
              <button
                type="button"
                onClick={() => setCredentials('worker@survey.org', 'Worker123!')}
                className="w-full text-left px-2.5 py-1.5 rounded text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 flex justify-between items-center transition-colors"
              >
                <span className="font-semibold text-emerald-700">Field Worker:</span>
                <span className="text-slate-500">worker@survey.org</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
