import React from 'react';
import { Mic, Volume2 } from 'lucide-react';

interface AudioVisualizerProps {
  micLevel: number; // 0.0 to 1.0
  loopbackLevel: number; // 0.0 to 1.0
  isCapturing: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  micLevel,
  loopbackLevel,
  isCapturing,
}) => {
  // Normalize levels with a minimum floor for visual clarity
  const micNormalized = Math.min(100, Math.max(4, Math.round(micLevel * 300)));
  const loopNormalized = Math.min(100, Math.max(4, Math.round(loopbackLevel * 300)));

  return (
    <div className="flex items-center gap-3 px-2.5 py-1 bg-black/40 rounded-lg border border-white/5 text-xs">
      {/* Microphone (Candidate) Level */}
      <div className="flex items-center gap-1.5">
        <Mic className={`w-3.5 h-3.5 ${isCapturing ? 'text-emerald-400' : 'text-zinc-500'}`} />
        <div className="w-12 h-1.5 bg-zinc-800 rounded-full overflow-hidden flex items-center">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-75 rounded-full"
            style={{ width: `${isCapturing ? micNormalized : 0}%` }}
          />
        </div>
      </div>

      {/* Divider */}
      <div className="w-px h-3 bg-zinc-700" />

      {/* Loopback (Interviewer) Level */}
      <div className="flex items-center gap-1.5">
        <Volume2 className={`w-3.5 h-3.5 ${isCapturing ? 'text-indigo-400' : 'text-zinc-500'}`} />
        <div className="w-12 h-1.5 bg-zinc-800 rounded-full overflow-hidden flex items-center">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-violet-400 transition-all duration-75 rounded-full"
            style={{ width: `${isCapturing ? loopNormalized : 0}%` }}
          />
        </div>
      </div>
    </div>
  );
};
