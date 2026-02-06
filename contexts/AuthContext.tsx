import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../integrations/supabase/client';
import { Profile, UserRole } from '../types';
import { useQueryClient } from '@tanstack/react-query';

interface AuthContextType {
  user: any | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  role: UserRole | null;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const initialized = useRef(false);

  const purgeSession = () => {
    try {
      const keys = Object.keys(localStorage);
      for (const key of keys) {
        if (key.includes('supabase.auth.token') || key.startsWith('sb-')) {
          localStorage.removeItem(key);
        }
      }
    } catch (e) {
      console.error("Storage purge error:", e);
    }
    setUser(null);
    setProfile(null);
    setLoading(false);
  };

  const fetchProfile = async (uId: string, metadata: any) => {
    // 1. Create a potential fallback from metadata
    const fallbackProfile: Profile = {
      id: uId,
      email: metadata?.email || '',
      role: (metadata?.role as UserRole) || 'community',
      city: metadata?.city || 'Unspecified',
      full_name: metadata?.full_name || 'Responder',
      phone_number: metadata?.phone_number || '',
      is_approved: metadata?.is_approved || metadata?.role === 'community',
      is_online: false,
      assigned_center_id: metadata?.assigned_center_id
    };
    
    // 2. ONLY set the fallback if we don't already have a valid profile in state
    // This prevents "role reversal" when switching tabs
    if (!profile) {
      setProfile(fallbackProfile);
    }

    try {
      // 3. Fetch source of truth from database
      const { data, error } = await supabase.from('profiles')
        .select('*')
        .eq('id', uId)
        .single();
      
      if (!error && data) {
        setProfile(data);
      }
    } catch (e) {
      console.debug("Profile background sync notice:", e);
    }
  };

  const initAuth = async () => {
    if (initialized.current) return;
    initialized.current = true;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id, session.user.user_metadata);
      }
    } catch (err) {
      console.error("Auth init error:", err);
      purgeSession();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        const u = session?.user;
        if (u) {
          setUser(u);
          await fetchProfile(u.id, u.user_metadata);
        }
        setLoading(false);
      } else if (event === 'SIGNED_OUT') {
        purgeSession();
        queryClient.clear();
      }
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!profile) return;
    setProfile(prev => prev ? { ...prev, ...updates } : null);
  };

  const signOut = async () => {
    try {
      queryClient.clear();
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("Supabase signOut error (ignoring):", err);
    } finally {
      purgeSession();
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      signOut, 
      role: profile?.role || user?.user_metadata?.role || null, 
      updateProfile 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};