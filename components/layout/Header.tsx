
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Menu, X, Shield, LogOut, Globe, User, Search, Phone, Map as MapIcon, Megaphone, LayoutDashboard, UserCog, UserCheck, RefreshCw, Radio, Power, MessageSquareQuote } from 'lucide-react';
import { cn } from '../../lib/utils';
import ProfileModal from './ProfileModal';
import { supabase } from '../../integrations/supabase/client';

const Header: React.FC = () => {
  const { user, profile, signOut, updateProfile } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isTogglingPresence, setIsTogglingPresence] = useState(false);

  const handleSignOut = async () => {
    // Navigate home first to avoid ProtectedRoute flashing
    navigate('/', { replace: true });
    await signOut();
  };

  const togglePresence = async () => {
    if (!profile || isTogglingPresence) return;
    setIsTogglingPresence(true);
    const nextStatus = !profile.is_online;
    
    try {
      const { error } = await (supabase.from('profiles') as any)
        .update({ is_online: nextStatus })
        .eq('id', profile.id);
      
      if (error) throw error;
      await updateProfile({ is_online: nextStatus });

      if (profile.role === 'volunteer') {
        await (supabase.from('volunteers') as any)
          .update({ availability: nextStatus })
          .eq('profile_id', profile.id);
      }
    } catch (err) {
      console.error("Presence Toggle Error:", err);
    } finally {
      setIsTogglingPresence(false);
    }
  };

  const homePath = user ? "/dashboard" : "/";

  const getNavLinks = () => {
    const baseLinks = [
      { path: homePath, label: user ? t('Command Hub', 'कमांड हब') : t('Home', 'होम'), icon: <LayoutDashboard size={14} /> }
    ];

    if (!user) {
      baseLinks.push({ path: "/reviews", label: t('Testimonials', 'प्रशंसापत्र'), icon: <MessageSquareQuote size={14} /> });
    }

    if (profile?.role && profile.role !== 'admin') {
      baseLinks.push({ path: "/map", label: t('Live Crisis Map', 'लाइव संकट मानचित्र'), icon: <MapIcon size={14} /> });
    }

    if (profile?.role === 'community') {
      baseLinks.splice(2, 0, { path: "/report", label: t('Report Incident', 'घटना की रिपोर्ट करें'), icon: <Megaphone size={14} /> });
    }

    if (profile?.role === 'admin') {
      baseLinks.push({ path: "/admin/volunteers", label: t('Verify Responders', 'उत्तरदाताओं को सत्यापित करें'), icon: <UserCheck size={14} /> });
      baseLinks.push({ path: "/admin/personnel", label: t('Personnel Allocation', 'कार्मिक आवंटन'), icon: <UserCog size={14} /> });
    }

    return baseLinks;
  };

  const navLinks = getNavLinks();

  return (
    <header className="z-50 w-full">
      <div className="bg-[#001a35] text-white py-2 border-b border-white/10 hidden sm:block">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-12 flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
          <div className="flex gap-6">
            <span className="flex items-center gap-1.5 text-blue-300"><Phone size={12} /> {t('Helpline', 'हेल्पलाइन')}: 1070 / 1078</span>
            <span className="flex items-center gap-1.5 border-l border-white/20 pl-6">{t('Sector', 'क्षेत्र')}: {profile?.city || t('India HQ', 'भारत मुख्यालय')}</span>
            
            {user && profile && profile.role !== 'community' && (
              <button 
                onClick={togglePresence}
                disabled={isTogglingPresence}
                className={cn(
                  "flex items-center gap-2 border-l border-white/20 pl-6 transition-all",
                  profile.is_online ? "text-emerald-400" : "text-slate-400"
                )}
              >
                <div className={cn("w-2 h-2 rounded-full", profile.is_online ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-slate-500")}></div>
                {profile.is_online ? t('Operational (Online)', 'परिचालन (ऑनलाइन)') : t('Off-Duty (Offline)', 'ऑफ-ड्यूटी (ऑफलाइन)')}
                {isTogglingPresence && <RefreshCw size={10} className="animate-spin ml-1" />}
              </button>
            )}
          </div>
          <div className="flex gap-6 items-center">
            <button 
              onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
              className="flex items-center gap-2 hover:text-yellow-400 transition-colors bg-white/5 px-4 py-1 rounded border border-white/10"
            >
              <Globe size={12} /> 
              <span>{language === 'en' ? 'English / हिन्दी' : 'हिन्दी / English'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white py-4 shadow-sm border-b border-gray-100">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-12 flex justify-between items-center">
          <Link to={homePath} className="flex items-center gap-4 group">
            <div className="p-3 bg-red-600 rounded-lg text-white shadow-xl group-hover:bg-red-700 transition-colors">
              <Shield className="h-10 w-10" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-[#002147] leading-none tracking-tight">{t('CrisisLink Connect', 'क्राइसिसलिंक कनेक्ट')}</h1>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1.5">{t('National Emergency Management Platform', 'राष्ट्रीय आपातकालीन प्रबंधन मंच')}</p>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-4">
            {user ? (
               <div className="flex items-center gap-3">
                 <button 
                  onClick={() => setIsProfileOpen(true)}
                  className="flex items-center gap-3 pl-4 pr-1 py-1 rounded-full border border-slate-200 hover:border-[#002147] bg-white group transition-all"
                 >
                   <div className="text-right">
                     <p className="text-[10px] font-black text-[#002147] leading-none mb-0.5">{profile?.full_name?.split(' ')[0] || 'User'}</p>
                     <p className="text-[8px] font-black uppercase text-slate-400">{t(profile?.role || '', profile?.role || '')}</p>
                   </div>
                   <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-white shadow-lg", profile?.is_online ? "bg-[#002147]" : "bg-slate-400")}>
                     <User size={18} />
                   </div>
                 </button>
                 <button 
                  onClick={handleSignOut}
                  title={t('Sign Out', 'साइन आउट')}
                  className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                 >
                   <LogOut size={20} />
                 </button>
               </div>
            ) : (
              <Link to="/auth" className="px-6 py-3 bg-[#002147] text-white text-[10px] font-black uppercase tracking-widest rounded shadow-lg hover:bg-slate-900 transition-all">
                {t('Responder Login', 'रिस्पोंडर लॉगिन')}
              </Link>
            )}
          </div>

          <button onClick={() => setIsOpen(!isOpen)} className="md:hidden p-2 text-slate-900">
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      <nav className="bg-[#002147] text-white shadow-lg hidden md:block border-b border-white/5">
        <div className="max-w-screen-2xl mx-auto px-12">
          <ul className="flex items-center h-14 gap-8">
            {navLinks.map((link) => (
              <li key={link.path} className="h-full">
                <Link to={link.path} className="h-full flex items-center px-2 text-[11px] font-black uppercase tracking-widest border-b-4 border-transparent hover:border-yellow-500 hover:text-yellow-400 transition-all">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
      {isProfileOpen && profile && (
        <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
      )}
    </header>
  );
};

export default Header;
