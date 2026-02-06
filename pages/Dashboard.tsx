import React, { useEffect, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { RefreshCw } from 'lucide-react';

const Dashboard: React.FC = () => {
  const { profile, user, loading } = useAuth();
  const navigate = useNavigate();

  useLayoutEffect(() => {
    // Wait for BOTH auth loading and profile sync to complete
    // This prevents redirecting to 'community' while the Admin profile is still fetching
    if (loading) return;

    // We prefer the 'profile' object as it comes from the DB (source of truth)
    const role = profile?.role || user?.user_metadata?.role;
    
    if (role) {
      const routes: Record<string, string> = {
        admin: '/admin',
        coordinator: '/coordinator',
        community: '/community',
        volunteer: '/volunteer',
        resource_manager: '/resources'
      };

      const target = routes[role] || '/community';
      
      // Safety: If we're an admin but metadata is stale, 
      // we might need to wait a tiny bit for the AuthContext profile sync
      if (role === 'community' && user?.user_metadata?.role !== 'community') {
         // This is the race condition state. We do nothing and let the next render cycle fix it.
         return;
      }

      navigate(target, { replace: true });
    }
  }, [profile, user, loading, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fafc]">
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <RefreshCw className="animate-spin text-[#002147]" size={40} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 bg-red-600 rounded-full"></div>
          </div>
        </div>
        <div className="text-center">
          <h2 className="text-[11px] font-black text-[#002147] uppercase tracking-[0.5em] mb-2">Synchronizing Credentials</h2>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Establishing Strategic Link...</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;