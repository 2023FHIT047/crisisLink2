import React, { useState, useEffect } from 'react';
import Header from '../components/layout/Header';
import { 
  MapPin, 
  Heart, 
  Clock, 
  Navigation, 
  CheckCircle, 
  Loader2, 
  AlertTriangle, 
  ChevronRight, 
  Activity, 
  ShieldAlert, 
  Users, 
  Send, 
  X, 
  Zap, 
  ExternalLink,
  MessageSquare,
  Building2,
  ShieldCheck,
  Target,
  RefreshCw,
  ClipboardList,
  CheckCircle2,
  Signal,
  Lock,
  Camera,
  Eye
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../integrations/supabase/client';
import { Incident, Volunteer, FieldReport, VolunteerTaskStatus } from '../types';
import { cn, getSeverityColor, formatDateTime } from '../lib/utils';

const VolunteerDashboard: React.FC = () => {
  const { profile, user, loading, updateProfile } = useAuth();
  const [isAvailable, setIsAvailable] = useState(profile?.is_online ?? true);
  const [missions, setMissions] = useState<Incident[]>([]);
  const [volunteerRecord, setVolunteerRecord] = useState<Volunteer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sosActive, setSosActive] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [isTransmitting, setIsTransmitting] = useState(false);
  
  const [selectedMission, setSelectedMission] = useState<Incident | null>(null);
  const [sitRepText, setSitRepText] = useState('');
  const [fieldStatus, setFieldStatus] = useState<VolunteerTaskStatus>('in_progress');

  const [isDbVerified, setIsDbVerified] = useState<boolean | null>(null);

  const fetchVolunteerData = async (silent = false) => {
    if (!user?.id || !profile) return;
    
    if (!silent) setIsLoading(true);
    else setIsRefetching(true);

    try {
      // 1. FRESH DB VERIFICATION CHECK
      const { data: freshProfile, error: pErr } = await supabase
        .from('profiles')
        .select('is_approved, is_online, city')
        .eq('id', user.id)
        .single();
      
      if (pErr) throw pErr;
      setIsDbVerified(freshProfile.is_approved);

      if (!freshProfile.is_approved) {
        setIsLoading(false);
        setIsRefetching(false);
        return;
      }

      // 2. Sync Volunteer Registry
      let { data: vData } = await (supabase.from('volunteers') as any)
        .select('*')
        .eq('profile_id', user.id)
        .maybeSingle();
      
      if (!vData && profile.role === 'volunteer') {
        const { data: createdData, error: createErr } = await (supabase.from('volunteers') as any).insert([{
          profile_id: user.id,
          full_name: profile.full_name || 'Responder',
          city: freshProfile.city || 'Mumbai',
          status: 'active',
          skills: [(profile as any).specialization || 'General Response'],
          availability: freshProfile.is_online
        }]).select().single();
        
        if (createErr) console.warn("Registry sync notice:", createErr.message);
        vData = createdData;
      }

      setVolunteerRecord(vData);
      setIsAvailable(vData?.availability ?? freshProfile.is_online);
      setSosActive(vData?.status === 'distress');

      // 3. Fetch Missions
      const { data: iData, error: iError } = await (supabase.from('incidents') as any)
        .select('*')
        .eq('city', freshProfile.city)
        .neq('status', 'resolved')
        .contains('assigned_volunteers', [user.id]);
      
      if (iError) throw iError;
      setMissions(iData || []);
    } catch (err) { 
      console.error("Field Intel Sync Error:", err); 
    } finally { 
      setIsLoading(false); 
      setIsRefetching(false);
    }
  };

  useEffect(() => { 
    if (profile && !loading) {
      fetchVolunteerData(); 
      
      const channel = supabase.channel('volunteer_mission_sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, () => fetchVolunteerData(true))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${user?.id}` }, () => fetchVolunteerData(true))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'volunteers', filter: `profile_id=eq.${user?.id}` }, () => fetchVolunteerData(true))
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [user?.id, profile, loading]);

  const handlePushSitRep = async () => {
    if (!selectedMission || !user?.id) return;
    setIsTransmitting(true);
    try {
      const { data: latestIncident, error: fetchErr } = await (supabase.from('incidents') as any)
        .select('field_reports, volunteer_tasks, status')
        .eq('id', selectedMission.id)
        .single();

      if (fetchErr) throw fetchErr;

      let updatedReports = latestIncident?.field_reports || [];
      if (sitRepText.trim()) {
        updatedReports = [...updatedReports, {
          id: Math.random().toString(36).substr(2, 9),
          volunteer_id: user.id,
          volunteer_name: profile?.full_name || 'Field Unit',
          text: sitRepText.trim(),
          timestamp: new Date().toISOString()
        }];
      }
      
      const updatedTasks = {
        ...(latestIncident?.volunteer_tasks || {}),
        [user.id]: fieldStatus
      };

      let nextStatus = latestIncident?.status || 'reported';
      if (nextStatus === 'reported' || nextStatus === 'verifying') nextStatus = 'active';

      const { error: updateError } = await (supabase.from('incidents') as any)
        .update({ 
          field_reports: updatedReports,
          volunteer_tasks: updatedTasks,
          status: nextStatus,
          verified: true
        })
        .eq('id', selectedMission.id);

      if (updateError) throw updateError;
      
      setSitRepText('');
      setSelectedMission(null);
      alert("MISSION STATUS UPDATED: Incident grid has been synchronized.");
      await fetchVolunteerData(true);
    } catch (err: any) {
      console.error("SitRep Transmission Failure:", err);
      alert("SIGNAL FAILURE: Ensure your SQL migration is complete.");
    } finally {
      setIsTransmitting(false);
    }
  };

  const toggleAvailability = async () => {
    if (loading || !user?.id) return;
    const nextVal = !isAvailable;
    setIsAvailable(nextVal);
    try {
      await (supabase.from('volunteers') as any).update({ availability: nextVal }).eq('profile_id', user.id);
      await (supabase.from('profiles') as any).update({ is_online: nextVal }).eq('id', user.id);
      await updateProfile({ is_online: nextVal });
    } catch (e) { console.error("Sync error:", e); }
  };

  const triggerSOS = async () => {
    if (!user?.id) return;
    const nextSos = !sosActive;
    setSosActive(nextSos);
    try {
      const { error } = await (supabase.from('volunteers') as any).update({ 
        status: nextSos ? 'distress' : 'active' 
      }).eq('profile_id', user.id);
      
      if (error) throw error;
      if (nextSos) alert("SOS BEACON ACTIVATED: Signal transmitted to National Command Deck.");
    } catch (err: any) {
      console.error("SOS Signal Failure:", err);
      alert("BEACON FAILURE: Could not connect to emergency satellite.");
      setSosActive(!nextSos);
    }
  };

  if (loading || (isLoading && isDbVerified === null)) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fafc]">
      <RefreshCw className="animate-spin text-red-600 mb-4" size={32} />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Verifying Strategic Link...</p>
    </div>
  );

  if (isDbVerified === false) {
    return (
      <div className="min-h-screen flex flex-col bg-[#f1f5f9]">
        <Header />
        <main className="flex-grow flex items-center justify-center p-6">
          <div className="max-w-2xl w-full bg-white rounded-[3rem] shadow-2xl border border-slate-200 overflow-hidden text-center p-12 relative">
             <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none rotate-12"><Lock size={200} /></div>
             <div className="w-24 h-24 bg-red-50 text-red-600 rounded-[2rem] flex items-center justify-center mx-auto mb-10 border border-red-100 shadow-xl shadow-red-100/50 relative z-10">
                <ShieldAlert size={48} />
             </div>
             <div className="relative z-10">
                <h2 className="text-4xl font-black text-[#002147] uppercase tracking-tighter mb-4">Verification Required</h2>
                <div className="w-16 h-1 bg-yellow-500 mx-auto mb-8"></div>
                <p className="text-slate-500 text-lg font-medium leading-relaxed mb-10">
                  Respected {profile?.full_name}, your enrollment is being reviewed by the National Command Deck. 
                  <br /><br />
                  Operational access is restricted until authorized by an administrator.
                </p>
                <button 
                  onClick={() => fetchVolunteerData()}
                  className="w-full py-5 bg-[#002147] text-white font-black uppercase tracking-widest text-[11px] rounded-2xl shadow-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-3 border-b-4 border-yellow-500"
                >
                  <RefreshCw size={16} /> Re-Sync Connection
                </button>
             </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen transition-colors duration-500", sosActive ? "bg-red-50" : "bg-[#f8fafc]")}>
      <Header />
      <main className="max-w-screen-2xl mx-auto px-4 sm:px-12 py-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6 border-b border-slate-200 pb-10">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-1 bg-red-600"></div>
              <span className="text-[10px] font-black uppercase tracking-widest text-[#002147]">Field Unit Dashboard</span>
            </div>
            <h1 className="text-4xl font-black text-[#002147] tracking-tight uppercase">Responder: {profile?.full_name}</h1>
          </div>
          
          <div className="flex items-center gap-4 w-full md:w-auto">
            <button onClick={() => fetchVolunteerData(true)} className="p-5 bg-white border border-slate-200 text-slate-400 rounded-xl shadow-sm"><RefreshCw size={20} className={cn(isRefetching && "animate-spin")} /></button>
            <button onClick={triggerSOS} className={cn("flex-1 md:flex-none px-10 py-5 font-black uppercase tracking-widest text-[11px] rounded-xl transition-all shadow-lg", sosActive ? 'bg-red-600 text-white animate-pulse' : 'bg-white border-2 border-red-600 text-red-600 hover:bg-red-50')}>{sosActive ? 'Abort SOS' : 'Send SOS'}</button>
            <button onClick={toggleAvailability} className={cn("flex-1 md:flex-none px-10 py-5 font-black uppercase tracking-widest text-[11px] rounded-xl border-b-4 shadow-lg transition-all", isAvailable ? 'bg-[#002147] text-white border-yellow-500' : 'bg-slate-200 text-slate-500 border-slate-300')}>{isAvailable ? 'Status: Online' : 'Status: Stealth'}</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-8">
            <h2 className="text-xl font-black text-[#002147] uppercase tracking-widest flex items-center gap-3"><Navigation size={20} className="text-red-600" /> Current Missions</h2>
            
            {missions.length > 0 ? (
              <div className="space-y-6">
                {missions.map((mission) => (
                  <div key={mission.id} className="bg-white border border-slate-200 shadow-sm rounded-[2.5rem] overflow-hidden group hover:border-[#002147] transition-all relative">
                    <div className={cn("absolute left-0 top-0 bottom-0 w-2", getSeverityColor(mission.severity).split(' ')[0])}></div>
                    <div className="p-8 md:p-10 flex flex-col md:flex-row justify-between items-start gap-8">
                      <div className="flex-grow">
                        <div className="flex items-center gap-4 mb-4">
                          <span className={cn("px-4 py-1.5 rounded text-[10px] font-black uppercase tracking-widest", getSeverityColor(mission.severity))}>{mission.severity}</span>
                          <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><Clock size={12} /> {formatDateTime(mission.created_at)}</span>
                        </div>
                        <h3 className="text-3xl font-black text-[#002147] mb-4 uppercase leading-none">{mission.title}</h3>
                        <p className="text-slate-600 text-lg italic mb-6">"{mission.description}"</p>
                        <div className="flex items-center gap-3 text-xs font-black text-slate-400 uppercase">
                          <MapPin size={16} className="text-red-600" /> {mission.address || 'Geo-Locked'} • Progress: {mission.volunteer_tasks?.[user?.id || ''] || 'Pending'}
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-3 w-full md:w-auto">
                        <button 
                          onClick={() => {
                            setSelectedMission(mission);
                            setFieldStatus(mission.volunteer_tasks?.[user?.id || ''] || 'in_progress');
                          }}
                          className="px-10 py-5 bg-[#002147] text-white text-[11px] font-black uppercase rounded-xl border-b-4 border-yellow-500 shadow-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-2"
                        >
                          Push Live Status <Zap size={16} />
                        </button>
                        <a 
                          href={`https://www.google.com/maps/dir/?api=1&destination=${mission.latitude},${mission.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-6 py-3 bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase rounded-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                        >
                          <Navigation size={14} /> Open GPS
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white p-24 text-center border-2 border-dashed border-slate-200 rounded-[3rem]">
                <CheckCircle className="text-slate-200 mx-auto mb-4" size={48} />
                <h3 className="text-2xl font-black text-[#002147] uppercase">No Active Missions</h3>
              </div>
            )}
          </div>

          <aside className="space-y-12">
            <div className="bg-[#002147] p-10 rounded-[3rem] text-white border-b-8 border-yellow-500 text-center relative overflow-hidden">
               <div className="absolute top-0 right-0 p-10 opacity-5 rotate-12"><Signal size={140} fill="white" /></div>
               <Target size={48} className="text-yellow-500 mx-auto mb-6" />
               <p className="text-7xl font-black mb-2">{missions.length}</p>
               <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Active Missions</p>
            </div>
            
            {sosActive && (
              <div className="bg-red-600 p-8 rounded-[2.5rem] text-white animate-pulse shadow-2xl flex items-center gap-6">
                <AlertTriangle size={32} />
                <div>
                   <p className="text-xs font-black uppercase tracking-widest">SOS ACTIVE</p>
                   <p className="text-[10px] opacity-80 uppercase">Satellite link transmitting distress signal.</p>
                </div>
              </div>
            )}
          </aside>
        </div>

        {selectedMission && (
          <div className="fixed inset-0 z-[2000] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4">
             <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
                <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
                   <div>
                      <p className="text-[10px] font-black text-yellow-500 uppercase tracking-widest mb-1">Status Transmission</p>
                      <h2 className="text-2xl font-black uppercase tracking-tight">{selectedMission.title}</h2>
                   </div>
                   <button onClick={() => setSelectedMission(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
                </div>

                <div className="p-10 space-y-8">
                   <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ground Progress Status</label>
                      <select 
                        value={fieldStatus}
                        onChange={(e) => setFieldStatus(e.target.value as VolunteerTaskStatus)}
                        className="w-full p-5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-black uppercase outline-none focus:ring-2 focus:ring-[#002147]"
                      >
                        <option value="pending">En Route (Pending)</option>
                        <option value="in_progress">On Site (In Progress)</option>
                        <option value="completed">Mission Accomplished (Completed)</option>
                      </select>
                   </div>

                   <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SitRep Intelligence (Optional)</label>
                      <textarea 
                        rows={4} 
                        value={sitRepText}
                        onChange={(e) => setSitRepText(e.target.value)}
                        placeholder="Current ground conditions, verifying signal, or requesting support..." 
                        className="w-full p-5 bg-white border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#002147] resize-none"
                      />
                   </div>

                   <div className="flex gap-4">
                      <button onClick={() => setSelectedMission(null)} className="flex-1 py-4 bg-slate-100 text-slate-500 font-black text-[11px] uppercase rounded-2xl hover:bg-slate-200">Cancel</button>
                      <button 
                        onClick={handlePushSitRep}
                        disabled={isTransmitting}
                        className="flex-[2] py-4 bg-[#002147] text-white font-black text-[11px] uppercase rounded-2xl hover:bg-slate-900 shadow-xl flex items-center justify-center gap-2 border-b-4 border-yellow-500"
                      >
                        {isTransmitting ? <Loader2 size={16} className="animate-spin" /> : <><Send size={14} /> Update Grid</>}
                      </button>
                   </div>
                </div>
             </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default VolunteerDashboard;