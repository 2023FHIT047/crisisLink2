import React, { useState, useEffect, useRef, useCallback } from 'react';
import Header from '../components/layout/Header';
import { 
  Camera, 
  MapPin, 
  Navigation, 
  Loader2, 
  ShieldCheck, 
  XCircle, 
  Search, 
  ArrowRight, 
  ArrowLeft,
  X,
  Mic,
  MicOff,
  PhoneCall,
  User as UserIcon,
  CheckCircle2,
  AlertTriangle,
  Target,
  Building2,
  ShieldAlert,
  ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap, Popup } from 'react-leaflet';
import L from 'leaflet';
import { GoogleGenAI } from "@google/genai";
import { supabase, INDIA_BOUNDS, INDIA_CENTER } from '../integrations/supabase/client';
import { useAuth } from '../contexts/AuthContext';
import { cn, calculateDistance } from '../lib/utils';
import { IncidentSeverity, ResourceCenter, Incident } from '../types';

const TACTICAL_MARKER_ICON = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const CENTER_MARKER_ICON = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const ClickHandler = ({ onLocationSelect }: { onLocationSelect: (latlng: L.LatLng) => void }) => {
  const map = useMap();
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng);
      map.flyTo(e.latlng, map.getZoom(), { animate: true, duration: 1.5 });
    },
  });
  return null;
};

const MapResizer = () => {
  const map = useMap();
  useEffect(() => {
    const sync = () => requestAnimationFrame(() => map.invalidateSize());
    sync();
    const t = setTimeout(sync, 300);
    return () => clearTimeout(t);
  }, [map]);
  return null;
};

const ReportIncident: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<IncidentSeverity>('medium');
  
  const [location, setLocation] = useState<{lat: number, lng: number}>({ lat: INDIA_CENTER[0], lng: INDIA_CENTER[1] });
  const [centers, setCenters] = useState<ResourceCenter[]>([]);
  const [existingIncidents, setExistingIncidents] = useState<Incident[]>([]);
  const [address, setAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<'none' | 'verified' | 'suspicious'>('none');
  const [aiReason, setAiReason] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Proximity Alert State
  const [nearbyIncident, setNearbyIncident] = useState<Incident | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }, (err) => console.debug("GPS Link Error:", err));
    }
    
    const fetchData = async () => {
      const { data: cData } = await (supabase.from('resource_centers').select('*') as any);
      setCenters(cData || []);
      
      const { data: iData } = await (supabase.from('incidents').select('*').neq('status', 'resolved') as any);
      setExistingIncidents(iData || []);
    };
    fetchData();
  }, []);

  // Proximity check on location change
  useEffect(() => {
    const findNearby = existingIncidents.find(inc => {
      const dist = calculateDistance(location.lat, location.lng, inc.latitude, inc.longitude);
      return dist <= 1.0; // 1km radius
    });
    setNearbyIncident(findNearby || null);
  }, [location, existingIncidents]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=in&limit=1`);
      const data = await res.json();
      if (data && data.length > 0) {
        setLocation({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
        setAddress(data[0].display_name);
      }
    } catch (err) { console.error("Search Fail:", err); } finally { setIsSearching(false); }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => { setPreviewUrl(reader.result as string); verifyWithAI(reader.result as string); };
      reader.readAsDataURL(file);
    }
  };

  const verifyWithAI = async (base64: string) => {
    setIsVerifying(true);
    try {
      const ai = new GoogleGenAI({ apiKey: "AIzaSyC7F0evakLJGFmBhJji4ERJM231zgoxgOA" });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ inlineData: { mimeType: 'image/jpeg', data: base64.split(',')[1] } }, { text: "Analyze emergency hazard. Decision: [Verified/Suspicious] | Reason: [One sentence]" }] }
      });
      const text = response.text || "";
      setVerificationResult(text.toLowerCase().includes('decision: verified') ? 'verified' : 'suspicious');
      setAiReason(text.split('Reason:')[1] || 'Signal analyzed.');
    } catch (error) { setVerificationResult('verified'); } finally { setIsVerifying(false); }
  };

  const handleSubmit = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const { error } = await (supabase.from('incidents').insert({
        title, 
        description, 
        severity, 
        latitude: location.lat, 
        longitude: location.lng, 
        city: profile?.city || 'Unspecified', 
        address, 
        image_url: previewUrl, 
        reporter_id: user?.id, 
        reporter_name: profile?.full_name || 'Citizen Responder',
        status: 'reported', 
        verified: verificationResult === 'verified'
      }) as any);
      if (error) throw error;
      setStep(3);
    } catch (err: any) { alert(`Transmission Fail: ${err.message}`); } finally { setIsSubmitting(false); }
  };

  const severityOptions: { value: IncidentSeverity; label: string; color: string }[] = [
    { value: 'low', label: 'Low', color: 'bg-blue-100 text-blue-800' },
    { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-800' },
    { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-800' },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <Header />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100 relative">
          
          <div className="h-2 w-full bg-slate-100">
            <div className="h-full bg-red-600 transition-all duration-700" style={{ width: `${(step / 3) * 100}%` }}></div>
          </div>

          <div className="p-8 sm:p-12">
            {step === 1 && (
              <div className="space-y-8 animate-in fade-in duration-500">
                <div className="flex flex-col gap-2">
                   <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">Incident Signal Transceiver</h1>
                   <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Phase 01: Critical Identification</p>
                </div>
                
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Incident Label</label>
                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Structural Fire at Block B" className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-red-500 text-black" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hazard Severity</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {severityOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setSeverity(opt.value)}
                          className={cn(
                            "py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-2",
                            severity === opt.value 
                              ? "bg-[#002147] border-[#002147] text-white shadow-lg scale-105" 
                              : "bg-white border-slate-100 text-slate-400 hover:border-slate-300"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Detailed Intelligence</label>
                    <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe ground conditions..." className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-red-500 resize-none text-black font-bold" />
                  </div>
                  
                  <button onClick={() => setStep(2)} disabled={!title || !description} className="w-full py-6 bg-[#002147] text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-xl hover:bg-slate-900 disabled:opacity-30 flex items-center justify-center gap-3 border-b-4 border-yellow-500 transition-all active:scale-[0.98]">
                    Geographic Targeting <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-8 animate-in slide-in-from-right duration-500">
                <div className="text-center">
                  <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter mb-2">Ground Zero Hub</h2>
                  <p className="text-red-600 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2">
                    <Target size={14} className="animate-pulse" /> Action: Tap map to drop mission pin
                  </p>
                </div>
                
                {/* PROXIMITY ALERT BANNER */}
                {nearbyIncident && (
                  <div className="bg-red-50 border-2 border-red-200 p-6 rounded-[2rem] flex flex-col sm:flex-row items-center justify-between gap-6 animate-in zoom-in duration-300 shadow-xl shadow-red-100">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-red-600 text-white rounded-xl flex items-center justify-center shadow-lg"><ShieldAlert size={24} className="animate-bounce" /></div>
                        <div>
                           <p className="text-xs font-black text-red-600 uppercase tracking-widest">Potential Duplicate Detected</p>
                           <p className="text-sm font-bold text-[#002147] uppercase leading-tight">
                              Incident: "{nearbyIncident.title}"
                           </p>
                           <p className="text-[10px] font-black text-slate-400 uppercase mt-1">
                              Distance: {(calculateDistance(location.lat, location.lng, nearbyIncident.latitude, nearbyIncident.longitude) * 1000).toFixed(0)} meters
                           </p>
                        </div>
                     </div>
                     <div className="flex gap-2">
                        <button 
                          onClick={() => navigate('/community')}
                          className="px-6 py-3 bg-white border border-red-200 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-50 transition-all"
                        >
                          View Existing
                        </button>
                        <button 
                          onClick={() => setNearbyIncident(null)}
                          className="px-6 py-3 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-md"
                        >
                          Different Event
                        </button>
                     </div>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Map Targeting</label>
                       <button onClick={() => setStep(1)} className="flex items-center gap-2 text-[9px] font-black text-slate-400 hover:text-red-600 uppercase transition-colors">
                          <ArrowLeft size={14} /> Back
                       </button>
                    </div>
                    <div className="h-[350px] rounded-[2.5rem] overflow-hidden border-2 border-slate-200 relative bg-[#f1f5f9] shadow-inner">
                      <MapContainer center={location} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        
                        {/* HAZARD PIN */}
                        <Marker position={location} icon={TACTICAL_MARKER_ICON}>
                          <Popup closeButton={false}>
                             <p className="text-[10px] font-black uppercase text-black">Target Zone</p>
                          </Popup>
                        </Marker>

                        {/* NEARBY CENTERS FOR CONTEXT */}
                        {centers.map(c => (
                          <Marker key={c.id} position={[c.latitude, c.longitude]} icon={CENTER_MARKER_ICON}>
                            <Popup closeButton={false}>
                               <p className="text-[9px] font-black uppercase text-emerald-700">{c.name}</p>
                            </Popup>
                          </Marker>
                        ))}

                        {/* OTHER ACTIVE INCIDENTS */}
                        {existingIncidents.map(inc => (
                          <Marker key={inc.id} position={[inc.latitude, inc.longitude]} opacity={0.4}>
                            <Popup closeButton={false}>
                               <p className="text-[9px] font-black uppercase text-slate-500">Known Report: {inc.title}</p>
                            </Popup>
                          </Marker>
                        ))}

                        <ClickHandler onLocationSelect={(latlng) => setLocation({ lat: latlng.lat, lng: latlng.lng })} />
                        <MapResizer />
                      </MapContainer>
                      <div className="absolute top-4 left-4 right-4 z-[1000] flex gap-2">
                        <form onSubmit={handleSearch} className="flex-grow flex gap-1">
                          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search location..." className="flex-grow px-4 py-3 bg-white rounded-xl text-xs font-black shadow-2xl border-none text-black outline-none focus:ring-2 focus:ring-red-600" />
                          <button type="submit" className="p-3 bg-red-600 text-white rounded-xl shadow-lg"><Search size={16} /></button>
                        </form>
                      </div>
                      <div className="absolute bottom-4 left-4 z-[1000]">
                         <div className="bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-200 shadow-lg flex items-center gap-2">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                            <span className="text-[8px] font-black uppercase text-slate-500">Rescue Hubs Visible</span>
                         </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Evidence Integration</label>
                      <div className="relative aspect-video bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200 overflow-hidden group">
                        <input type="file" id="img-up" className="hidden" accept="image/*" onChange={handleFileUpload} />
                        {previewUrl ? (
                          <div className="h-full w-full relative">
                            <img src={previewUrl} className="w-full h-full object-cover" alt="Preview" />
                            <button onClick={() => setPreviewUrl(null)} className="absolute top-4 right-4 p-2 bg-red-600 text-white rounded-full hover:scale-110 transition-transform"><X size={16} /></button>
                            {isVerifying && <div className="absolute inset-0 bg-white/80 flex items-center justify-center"><Loader2 className="text-red-600 animate-spin" size={40} /></div>}
                          </div>
                        ) : (
                          <label htmlFor="img-up" className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 transition-all">
                            <Camera size={48} className="text-red-600 mb-3" />
                            <p className="font-black text-[#002147] text-xs uppercase tracking-widest">Upload Field Evidence</p>
                          </label>
                        )}
                      </div>
                    </div>

                    {verificationResult !== 'none' && (
                       <div className={cn("p-6 rounded-3xl border flex items-start gap-4 animate-in zoom-in duration-300", verificationResult === 'verified' ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100")}>
                          <ShieldCheck className={cn(verificationResult === 'verified' ? "text-green-600" : "text-red-600")} size={24} />
                          <div>
                             <p className="text-[10px] font-black uppercase text-slate-900">AI Signal Analysis</p>
                             <p className="text-xs font-bold text-slate-600 mt-1 italic">{aiReason}</p>
                          </div>
                       </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-4">
                  <button onClick={() => setStep(1)} className="px-10 py-6 bg-slate-100 text-slate-500 font-black rounded-2xl text-[10px] uppercase hover:bg-slate-200 transition-all">Previous</button>
                  <button 
                    onClick={handleSubmit} 
                    disabled={isSubmitting || isVerifying || (!!nearbyIncident)} 
                    className={cn(
                      "flex-grow py-6 text-white font-black rounded-2xl shadow-2xl transition-all border-b-8 flex items-center justify-center gap-3",
                      !!nearbyIncident ? "bg-slate-400 border-slate-600 cursor-not-allowed" : "bg-red-600 border-red-900 hover:bg-red-700"
                    )}
                  >
                    {isSubmitting ? <Loader2 size={24} className="animate-spin" /> : <><CheckCircle2 size={24} /> Transmit Signal</>}
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="py-20 text-center space-y-8 animate-in zoom-in duration-500">
                <div className="w-32 h-32 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-green-100 ring-8 ring-green-50"><CheckCircle2 size={64} /></div>
                <h2 className="text-5xl font-black text-[#002147] uppercase tracking-tighter">Signal Locked</h2>
                <p className="text-slate-500 font-medium max-w-sm mx-auto leading-relaxed">Your mission report has been synchronized with the National Grid. Local Command Units are being notified of the impact point.</p>
                <button onClick={() => navigate('/community')} className="px-12 py-6 bg-[#002147] text-white font-black rounded-2xl shadow-xl hover:bg-slate-900 transition-all uppercase tracking-widest text-[11px] border-b-4 border-yellow-500 active:scale-95">Return to Hub Dashboard</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportIncident;
