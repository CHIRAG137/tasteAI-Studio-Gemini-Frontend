import { useState, useRef, useCallback, useEffect } from 'react';

interface UseSpeechToTextProps {
  onResult: (text: string) => void;
  onError: (error: string) => void;
  language?: string;
  silenceTimeout?: number; // seconds of silence before warning
  stopTimeout?: number; // additional seconds before auto-stop
}

export const useSpeechToText = ({
  onResult,
  onError,
  language = 'en-US',
  silenceTimeout = 10,
  stopTimeout = 5,
}: UseSpeechToTextProps) => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSilenceWarning, setShowSilenceWarning] = useState(false);
  const [audioLevels, setAudioLevels] = useState<number[]>([]);
  const [silenceCountdown, setSilenceCountdown] = useState<number | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const stopTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioLevelIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const silenceStartTimeRef = useRef<number | null>(null);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (silenceCheckIntervalRef.current) {
      clearInterval(silenceCheckIntervalRef.current);
      silenceCheckIntervalRef.current = null;
    }
    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current);
      audioLevelIntervalRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setShowSilenceWarning(false);
    setAudioLevels([]);
    setSilenceCountdown(null);
    silenceStartTimeRef.current = null;
  }, []);

  // Send audio to backend for transcription
  const sendAudioToBackend = useCallback(async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/elevenlabs/speech-to-text`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to transcribe audio');
      }

      const data = await response.json();
      
      if (data.result?.text) {
        onResult(data.result.text.text);
      } else {
        throw new Error('No transcription text received');
      }
    } catch (error: any) {
      console.error('Speech-to-text error:', error);
      onError(error.message || 'Failed to transcribe audio');
    } finally {
      setIsProcessing(false);
    }
  }, [onResult, onError]);

  // Stop recording and process audio
  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      return;
    }

    return new Promise<void>((resolve) => {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.onstop = async () => {
          if (audioChunksRef.current.length > 0) {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            audioChunksRef.current = [];
            
            // Send to backend
            await sendAudioToBackend(audioBlob);
          }
          
          cleanup();
          setIsListening(false);
          resolve();
        };

        mediaRecorderRef.current.stop();
      }
    });
  }, [cleanup, sendAudioToBackend]);

  // Update audio levels for visualization
  const updateAudioLevels = useCallback(() => {
    if (!analyserRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Get 8 frequency bands for visualization
    const bands = 8;
    const bandSize = Math.floor(bufferLength / bands);
    const levels: number[] = [];

    for (let i = 0; i < bands; i++) {
      let sum = 0;
      for (let j = 0; j < bandSize; j++) {
        sum += dataArray[i * bandSize + j];
      }
      // Normalize to 0-100
      levels.push(Math.min(100, (sum / bandSize / 255) * 100 * 2));
    }

    setAudioLevels(levels);
  }, []);

  // Detect silence using audio analysis
  const checkForSilence = useCallback(() => {
    if (!analyserRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Calculate average volume
    const average = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
    const threshold = 10; // Silence threshold

    if (average < threshold) {
      // User is silent
      if (!silenceStartTimeRef.current) {
        silenceStartTimeRef.current = Date.now();
      }

      const silenceDuration = (Date.now() - silenceStartTimeRef.current) / 1000;

      if (silenceDuration >= silenceTimeout && !showSilenceWarning) {
        setShowSilenceWarning(true);
        
        // Start countdown
        const remainingTime = stopTimeout;
        setSilenceCountdown(remainingTime);
        
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
        }
        
        countdownIntervalRef.current = setInterval(() => {
          setSilenceCountdown(prev => {
            if (prev === null || prev <= 1) {
              return null;
            }
            return prev - 1;
          });
        }, 1000);

        // Start stop timer
        if (!stopTimerRef.current) {
          stopTimerRef.current = setTimeout(() => {
            stopRecording();
          }, stopTimeout * 1000);
        }
      }
    } else {
      // User is speaking - reset everything
      silenceStartTimeRef.current = null;
      
      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setShowSilenceWarning(false);
      setSilenceCountdown(null);
    }
  }, [silenceTimeout, stopTimeout, showSilenceWarning, stopRecording]);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Setup audio context for silence detection
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.8;
      source.connect(analyserRef.current);

      // Setup media recorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsListening(true);

      // Start checking for silence every 500ms
      silenceCheckIntervalRef.current = setInterval(checkForSilence, 500);
      
      // Update audio levels every 50ms for smooth visualization
      audioLevelIntervalRef.current = setInterval(updateAudioLevels, 50);

    } catch (error: any) {
      console.error('Microphone access error:', error);
      onError(error.message || 'Failed to access microphone');
      cleanup();
    }
  }, [checkForSilence, updateAudioLevels, onError, cleanup]);

  // Toggle recording
  const toggleListening = useCallback(async () => {
    if (isListening) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }, [isListening, startRecording, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    isListening,
    isProcessing,
    showSilenceWarning,
    silenceCountdown,
    audioLevels,
    toggleListening,
    stopRecording,
  };
};
