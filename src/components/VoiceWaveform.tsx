import { cn } from "@/lib/utils";

interface VoiceWaveformProps {
  audioLevels: number[];
  isListening: boolean;
  showSilenceWarning?: boolean;
  silenceCountdown?: number | null;
  className?: string;
}

export const VoiceWaveform = ({
  audioLevels,
  isListening,
  showSilenceWarning,
  silenceCountdown,
  className,
}: VoiceWaveformProps) => {
  if (!isListening) return null;

  // Use default levels if no audio data
  const levels = audioLevels.length > 0 ? audioLevels : [10, 10, 10, 10, 10, 10, 10, 10];

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="flex items-center justify-center gap-1 h-12 px-4 py-2 bg-gradient-to-r from-red-500/10 to-orange-500/10 rounded-lg border border-red-500/20">
        {levels.map((level, index) => (
          <div
            key={index}
            className={cn(
              "w-1 rounded-full transition-all duration-75",
              showSilenceWarning
                ? "bg-yellow-500"
                : "bg-gradient-to-t from-red-500 to-orange-400"
            )}
            style={{
              height: `${Math.max(4, level * 0.4)}px`,
              opacity: showSilenceWarning ? 0.6 : 0.8 + (level / 500),
            }}
          />
        ))}
        <span className="ml-3 text-xs font-medium text-red-600 dark:text-red-400 animate-pulse">
          {showSilenceWarning ? "No speech detected" : "Listening..."}
        </span>
      </div>
      
      {showSilenceWarning && silenceCountdown !== null && (
        <div className="flex items-center gap-2 text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-1.5 rounded-md border border-yellow-500/30">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>
            Please speak now! Stopping in <strong>{silenceCountdown}s</strong>
          </span>
        </div>
      )}
    </div>
  );
};
