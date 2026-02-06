
import React, { useState, useEffect } from 'react';
import { MemoryRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';

// Pages
import Index from './pages/Index';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import CommunityDashboard from './pages/CommunityDashboard';
import VolunteerDashboard from './pages/VolunteerDashboard';
import ResourceManagerDashboard from './pages/ResourceManagerDashboard';
import CoordinatorDashboard from './pages/CoordinatorDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AdminPersonnelAllocation from './pages/AdminPersonnelAllocation';
import AdminVolunteerVerification from './pages/AdminVolunteerVerification';
import AdminDatabaseSync from './pages/AdminDatabaseSync';
import AdminSQLConsole from './pages/AdminSQLConsole';
import SystemReset from './pages/SystemReset';
import LiveMap from './pages/LiveMap';
import ReportIncident from './pages/ReportIncident';
import Reviews from './pages/Reviews';
import NotFound from './pages/NotFound';
import { RefreshCw } from 'lucide-react';
import NotificationFeed from './components/layout/NotificationFeed';

const queryClient = new QueryClient();

const ProtectedRoute: React.FC<{ children: React.ReactNode, allowedRoles?: string[] }> = ({ children, allowedRoles }) => {
  const { user, profile, loading } = useAuth();
  const role = profile?.role || user?.user_metadata?.role;

  if (loading && !user) return (
    <div className="flex flex-col items-center justify-center h-screen bg-white">
      <RefreshCw className="animate-spin text-slate-300 mb-4" size={32} />
      <span className="font-black text-slate-400 uppercase tracking-widest text-xs">Syncing Command Deck...</span>
    </div>
  );
  
  if (!user && !loading) return <Navigate to="/auth" replace />;
  
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

const RootRoute = () => {
  const { user, loading } = useAuth();
  const [showRetry, setShowRetry] = useState(false);
  
  useEffect(() => {
    let timer: any;
    if (loading) {
      timer = setTimeout(() => setShowRetry(true), 2000);
    }
    return () => clearTimeout(timer);
  }, [loading]);
  
  // Fast-track: If we have a user from metadata, don't show the loading screen
  if (loading && !user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-white">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="animate-spin text-red-600" size={32} />
          <span className="font-black text-slate-900 uppercase tracking-[0.4em] text-xs">Uplink Active</span>
        </div>
        
        {showRetry && (
          <div className="mt-12 flex flex-col items-center animate-in fade-in zoom-in duration-500">
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg flex items-center gap-2 hover:bg-black transition-all"
            >
              <RefreshCw size={14} /> Force Re-Sync
            </button>
          </div>
        )}
      </div>
    );
  }
  
  if (user) return <Navigate to="/dashboard" replace />;
  
  return <Index />;
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <Router>
            {/* Global Real-time Notification System */}
            <NotificationFeed />
            
            <Routes>
              <Route path="/" element={<RootRoute />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
              <Route path="/admin/personnel" element={<ProtectedRoute allowedRoles={['admin']}><AdminPersonnelAllocation /></ProtectedRoute>} />
              <Route path="/admin/volunteers" element={<ProtectedRoute allowedRoles={['admin']}><AdminVolunteerVerification /></ProtectedRoute>} />
              <Route path="/admin/sync" element={<ProtectedRoute allowedRoles={['admin']}><AdminDatabaseSync /></ProtectedRoute>} />
              <Route path="/admin/console" element={<ProtectedRoute allowedRoles={['admin']}><AdminSQLConsole /></ProtectedRoute>} />
              <Route path="/admin/reset" element={<ProtectedRoute allowedRoles={['admin']}><SystemReset /></ProtectedRoute>} />
              <Route path="/community" element={<ProtectedRoute allowedRoles={['community', 'admin']}><CommunityDashboard /></ProtectedRoute>} />
              <Route path="/coordinator" element={<ProtectedRoute allowedRoles={['coordinator', 'admin']}><CoordinatorDashboard /></ProtectedRoute>} />
              <Route path="/volunteer" element={<ProtectedRoute allowedRoles={['volunteer', 'admin']}><VolunteerDashboard /></ProtectedRoute>} />
              <Route path="/resources" element={<ProtectedRoute allowedRoles={['resource_manager', 'admin']}><ResourceManagerDashboard /></ProtectedRoute>} />
              <Route path="/map" element={<LiveMap />} />
              <Route path="/report" element={<ProtectedRoute><ReportIncident /></ProtectedRoute>} />
              <Route path="/reviews" element={<Reviews />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Router>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
};

export default App;
