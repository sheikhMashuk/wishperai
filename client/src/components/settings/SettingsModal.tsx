import React, { useState } from 'react';
import type { AppSettings } from '../../types';
import { X, ShieldCheck, Cpu, Mic, FileText, Key, Check, Zap, Globe, Keyboard } from 'lucide-react';

interface SettingsModalProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onUpdateSettings,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'models' | 'audio' | 'resume' | 'stealth'>('models');
  const [resumeText, setResumeText] = useState(
    settings.resumeContext ||
      'Senior Full-Stack Engineer with 6+ years building distributed Rust/Go backends, low-latency WebSockets, and modern React/Next.js architectures. Led high-throughput API scaling handling 100k+ req/sec.'
  );
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [openRouterModels, setOpenRouterModels] = useState<any[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [openRouterSearch, setOpenRouterSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  React.useEffect(() => {
    if (settings.modelProvider === 'openrouter' && settings.apiKey) {
      setIsFetchingModels(true);
      fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          Authorization: `Bearer ${settings.apiKey}`
        }
      })
      .then(res => res.json())
      .then(data => {
        if (data && data.data) {
          // Store all models, let the user search through them
          setOpenRouterModels(data.data);
          
          if (!settings.openRouterModel && data.data.length > 0) {
            const defaultFree = data.data.find((m: any) => parseFloat(m.pricing?.prompt || '0') === 0) || data.data[0];
            onUpdateSettings({ openRouterModel: defaultFree.id });
          }
        }
      })
      .catch(err => console.error('Failed to fetch openrouter models', err))
      .finally(() => setIsFetchingModels(false));
    }
  }, [settings.modelProvider, settings.apiKey]);

  const handleSaveResume = () => {
    onUpdateSettings({ resumeContext: resumeText });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn no-drag">
      <div className="w-full max-w-lg bg-zinc-900/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-semibold text-zinc-100">WhisperAI Configuration & Intelligence</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/5 px-3 sm:px-4 pt-2 gap-1 sm:gap-2 text-xs font-medium overflow-x-auto cluely-scrollbar">
          <button
            onClick={() => setActiveTab('models')}
            className={`pb-2.5 px-2.5 sm:px-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'models'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            AI Engine
          </button>
          <button
            onClick={() => setActiveTab('audio')}
            className={`pb-2.5 px-2.5 sm:px-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'audio'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            Speech & Audio
          </button>
          <button
            onClick={() => setActiveTab('resume')}
            className={`pb-2.5 px-2.5 sm:px-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'resume'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Resume Context
          </button>
          <button
            onClick={() => setActiveTab('stealth')}
            className={`pb-2.5 px-2.5 sm:px-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'stealth'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            Hotkeys & Stealth
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-5 space-y-4 text-xs max-h-[65vh] overflow-y-auto cluely-scrollbar">
          {activeTab === 'models' && (
            <div className="space-y-4">
              <div>
                <label className="block text-zinc-300 font-medium mb-1.5">Intelligence Provider</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { id: 'groq', name: 'Groq Cloud', desc: 'Ultra-fast speed (<250ms)' },
                    { id: 'openrouter', name: 'OpenRouter', desc: 'Free & Premium LLMs' },
                    { id: 'anthropic', name: 'Claude 3.5 Sonnet', desc: 'Deep architectural reasoning' },
                    { id: 'openai', name: 'OpenAI GPT-4o', desc: 'Balanced copilot responses' },
                    { id: 'local', name: 'Local Ollama / GGUF', desc: '100% Offline & Private' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      onClick={() => onUpdateSettings({ modelProvider: p.id as any })}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        settings.modelProvider === p.id
                          ? 'border-indigo-500 bg-indigo-500/10 text-white'
                          : 'border-white/5 bg-white/5 text-zinc-400 hover:border-white/10'
                      }`}
                    >
                      <div className="font-semibold text-zinc-200 flex items-center justify-between">
                        {p.name}
                        {p.id === 'groq' && <Zap className="w-3 h-3 text-amber-400" />}
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">{p.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {settings.modelProvider === 'groq' && (
                <div>
                  <label className="block text-zinc-300 font-medium mb-1.5">Groq Fast Model</label>
                  <select
                    value={settings.groqModel || 'llama-3.3-70b-versatile'}
                    onChange={(e) => onUpdateSettings({ groqModel: e.target.value as any })}
                    className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-zinc-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="llama-3.3-70b-versatile">Llama 3.3 70B Versatile (Recommended - High IQ)</option>
                    <option value="llama-3.1-8b-instant">Llama 3.1 8B Instant (Ultra Fast ~150ms)</option>
                  </select>
                </div>
              )}

              {settings.modelProvider === 'local' && (
                <div className="space-y-2">
                  <div>
                    <label className="block text-zinc-300 font-medium mb-1">Local Ollama Endpoint</label>
                    <input
                      type="text"
                      value={settings.localModelUrl || 'http://localhost:11434'}
                      onChange={(e) => onUpdateSettings({ localModelUrl: e.target.value })}
                      placeholder="http://localhost:11434"
                      className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-zinc-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-300 font-medium mb-1">Model Name</label>
                    <input
                      type="text"
                      value={settings.localModelName || 'llama3.2'}
                      onChange={(e) => onUpdateSettings({ localModelName: e.target.value })}
                      placeholder="llama3.2 or deepseek-r1:8b"
                      className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-zinc-200 font-mono"
                    />
                  </div>
                </div>
              )}

              {settings.modelProvider === 'openrouter' && (
                <div>
                  <label className="block text-zinc-300 font-medium mb-1.5">OpenRouter Model</label>
                  {isFetchingModels ? (
                    <div className="text-xs text-zinc-400 py-2">Fetching models from OpenRouter...</div>
                  ) : openRouterModels.length > 0 ? (
                    <div className="relative">
                      <div className="mb-2 text-xs text-zinc-400 flex justify-between">
                        <span>Current: <strong className="text-indigo-400">{settings.openRouterModel || 'None'}</strong></span>
                      </div>
                      <input 
                        type="text" 
                        value={openRouterSearch}
                        onChange={(e) => {
                          setOpenRouterSearch(e.target.value);
                          setIsDropdownOpen(true);
                        }}
                        onFocus={() => setIsDropdownOpen(true)}
                        placeholder="Search models (e.g. llama, anthropic, google)..."
                        className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-zinc-200 focus:outline-none focus:border-indigo-500"
                      />
                      {isDropdownOpen && openRouterSearch.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-zinc-800 border border-white/10 rounded-lg shadow-xl cluely-scrollbar">
                          {openRouterModels
                            .filter(m => (m.id + m.name).toLowerCase().includes(openRouterSearch.toLowerCase()))
                            .slice(0, 50) // Limit to 50 results to prevent UI lag
                            .map(m => {
                              const isFree = parseFloat(m.pricing?.prompt || '0') === 0 && parseFloat(m.pricing?.completion || '0') === 0;
                              return (
                                <button
                                  key={m.id}
                                  onClick={() => {
                                    onUpdateSettings({ openRouterModel: m.id });
                                    setOpenRouterSearch('');
                                    setIsDropdownOpen(false);
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-white/10 transition-colors border-b border-white/5 last:border-0 flex justify-between items-center"
                                >
                                  <span className="text-zinc-200 truncate pr-2">{m.id}</span>
                                  {isFree && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">Free</span>}
                                </button>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  ) : settings.apiKey ? (
                    <div className="text-xs text-rose-400 py-2">Failed to fetch models. Check API Key.</div>
                  ) : (
                    <div className="text-xs text-zinc-400 py-2">Please enter your API Key below to load all models.</div>
                  )}
                </div>
              )}

              {settings.modelProvider !== 'local' && (
                <div>
                  <label className="block text-zinc-300 font-medium mb-1.5 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-zinc-400" />
                    API Key (Bring-Your-Own-Key)
                  </label>
                  <input
                    type="password"
                    value={settings.apiKey}
                    onChange={(e) => onUpdateSettings({ apiKey: e.target.value })}
                    placeholder="gsk_... or sk-ant-... or sk-..."
                    className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-zinc-200 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">
                    * If left blank, WhisperAI utilizes its built-in smart offline heuristic engine.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'audio' && (
            <div className="space-y-4">
              <div>
                <label className="block text-zinc-300 font-medium mb-1.5 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-zinc-400" />
                  Speech Recognition Language
                </label>
                <select
                  value={settings.speechLanguage || 'en-US'}
                  onChange={(e) => onUpdateSettings({ speechLanguage: e.target.value })}
                  className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-zinc-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="en-US">English (United States)</option>
                  <option value="en-GB">English (United Kingdom)</option>
                  <option value="en-IN">English (India)</option>
                  <option value="es-ES">Spanish (Spain / LatAm)</option>
                  <option value="fr-FR">French</option>
                  <option value="de-DE">German</option>
                  <option value="hi-IN">Hindi</option>
                </select>
              </div>

              <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-1">
                <div className="font-semibold text-zinc-200">Real-Time Streaming Speech Engine</div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Continuous zero-latency speech recognition transcribes words instantly. When interviewer questions are detected, answers generate automatically in sub-500ms.
                </p>
              </div>

              <div className="p-3 bg-white/5 rounded-xl border border-white/5 space-y-1">
                <div className="font-semibold text-zinc-200">WASAPI Loopback Capture</div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Directly intercepts remote interviewer audio from Zoom, Teams, Google Meet, and browser tabs.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'resume' && (
            <div className="space-y-3">
              <label className="block text-zinc-300 font-medium">
                Candidate Resume / Project Portfolio (RAG Context)
              </label>
              <textarea
                rows={6}
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                placeholder="Paste your resume, skills, key projects, and architecture achievements here..."
                className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-zinc-200 focus:outline-none focus:border-indigo-500 font-mono text-[11px] leading-relaxed resize-none"
              />
              <button
                onClick={handleSaveResume}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
              >
                {savedSuccess ? <Check className="w-3.5 h-3.5" /> : null}
                {savedSuccess ? 'Saved & Injected into Copilot!' : 'Save Resume Context'}
              </button>
            </div>
          )}

          {activeTab === 'stealth' && (
            <div className="space-y-3">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-1">
                <div className="font-semibold text-emerald-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  WDA_EXCLUDEFROMCAPTURE Active
                </div>
                <p className="text-[11px] text-emerald-200/80 leading-relaxed">
                  The application is excluded from Windows Graphics Capture, OBS screen capture, Zoom, Meet, and Teams screen sharing.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex justify-between items-center p-2 bg-white/5 rounded-lg">
                  <span className="text-zinc-300">Emergency Hide / Re-Open Overlay</span>
                  <kbd className="px-2 py-0.5 bg-black/50 border border-white/10 rounded text-zinc-300 font-mono text-[10px]">
                    Ctrl + Shift + H
                  </kbd>
                </div>
                <div className="flex justify-between items-center p-2 bg-white/5 rounded-lg">
                  <span className="text-zinc-300">Toggle Click-Through Lock</span>
                  <kbd className="px-2 py-0.5 bg-black/50 border border-white/10 rounded text-zinc-300 font-mono text-[10px]">
                    Ctrl + Shift + T
                  </kbd>
                </div>
                <div className="flex justify-between items-center p-2 bg-white/5 rounded-lg">
                  <span className="text-zinc-300">Emergency Close / Quit Application</span>
                  <kbd className="px-2 py-0.5 bg-black/50 border border-white/10 rounded text-rose-300 font-mono text-[10px]">
                    Ctrl + Shift + Q
                  </kbd>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
