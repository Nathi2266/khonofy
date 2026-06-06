import { useCallback, useEffect, useRef, useState } from 'react';

const SpeechRecognition =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

const MAX_NETWORK_RETRIES = 5;

function getTranscriptionWarning(code) {
  if (code === 'network') {
    return 'Live transcription is reconnecting. Your microphone is still active — keep speaking or type below.';
  }
  if (code === 'service-not-allowed') {
    return 'Speech-to-text is unavailable in this browser session. You can still record and type your note below.';
  }
  return '';
}

export function useSpeechRecognition() {
  const recognitionRef = useRef(null);
  const listeningIntentRef = useRef(false);
  const restartTimeoutRef = useRef(null);
  const networkRetriesRef = useRef(0);
  const statusRef = useRef('idle');
  const startRecognitionRef = useRef(() => {});

  const [status, setStatus] = useState('idle');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState('');
  const [transcriptionWarning, setTranscriptionWarning] = useState('');

  const isSupported = Boolean(SpeechRecognition);

  const setStatusSafe = useCallback((nextStatus) => {
    statusRef.current = nextStatus;
    setStatus(nextStatus);
  }, []);

  const clearRestartTimer = useCallback(() => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
  }, []);

  const scheduleRecognitionRestart = useCallback(() => {
    if (!listeningIntentRef.current) return;

    clearRestartTimer();
    restartTimeoutRef.current = setTimeout(() => {
      if (!listeningIntentRef.current) return;
      startRecognitionRef.current();
    }, 300);
  }, [clearRestartTimer]);

  const attachRecognitionHandlers = useCallback((recognition) => {
    recognition.onstart = () => {
      setStatusSafe('listening');
      setError('');
    };

    recognition.onresult = (event) => {
      networkRetriesRef.current = 0;
      setTranscriptionWarning('');

      let finalText = '';
      let interimText = '';

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result[0]?.transcript || '';
        if (result.isFinal) {
          finalText += text;
        } else {
          interimText += text;
        }
      }

      if (finalText) {
        setTranscript((current) => {
          const trimmedCurrent = current.trim();
          const trimmedFinal = finalText.trim();
          if (!trimmedFinal) return current;
          return trimmedCurrent ? `${trimmedCurrent} ${trimmedFinal}` : trimmedFinal;
        });
      }

      setInterimTranscript(interimText.trim());
    };

    recognition.onerror = (event) => {
      const code = event.error;

      if (code === 'aborted' || !listeningIntentRef.current) {
        return;
      }

      if (code === 'no-speech') {
        return;
      }

      if (code === 'network' || code === 'service-not-allowed') {
        networkRetriesRef.current += 1;
        const warning = getTranscriptionWarning(code);
        if (warning) {
          setTranscriptionWarning(warning);
        }

        if (networkRetriesRef.current >= MAX_NETWORK_RETRIES) {
          setTranscriptionWarning(
            'Speech-to-text could not connect. Your microphone is still recording — type or edit the transcript below.'
          );
        }
        return;
      }

      const message =
        code === 'not-allowed'
          ? 'Microphone access was denied. Allow mic permission and try again.'
          : code === 'audio-capture'
            ? 'No microphone was found on this device.'
            : 'Speech recognition failed. Please try again or type your note below.';

      setError(message);
      setStatusSafe('error');
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setInterimTranscript('');

      if (!listeningIntentRef.current) {
        setStatusSafe('idle');
        return;
      }

      scheduleRecognitionRestart();
    };
  }, [scheduleRecognitionRestart, setStatusSafe]);

  const startRecognition = useCallback(() => {
    if (!SpeechRecognition || !listeningIntentRef.current) {
      return;
    }

    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore stale instance errors
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    attachRecognitionHandlers(recognition);

    try {
      recognition.start();
    } catch {
      setTranscriptionWarning('Speech-to-text could not start. Your microphone is still active — type your note below.');
    }
  }, [attachRecognitionHandlers]);

  startRecognitionRef.current = startRecognition;

  const stop = useCallback(() => {
    listeningIntentRef.current = false;
    networkRetriesRef.current = 0;
    clearRestartTimer();

    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore stop errors
    }

    recognitionRef.current = null;
    setInterimTranscript('');
    setTranscriptionWarning('');

    if (statusRef.current === 'listening') {
      setStatusSafe('idle');
    }
  }, [clearRestartTimer, setStatusSafe]);

  const reset = useCallback(() => {
    setStatusSafe('idle');
    setTranscript('');
    setInterimTranscript('');
    setError('');
    setTranscriptionWarning('');
    networkRetriesRef.current = 0;
  }, [setStatusSafe]);

  const start = useCallback(() => {
    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser.');
      setStatusSafe('error');
      return;
    }

    listeningIntentRef.current = true;
    networkRetriesRef.current = 0;
    setError('');
    setTranscriptionWarning('');
    setStatusSafe('listening');
    startRecognition();
  }, [setStatusSafe, startRecognition]);

  useEffect(() => () => {
    listeningIntentRef.current = false;
    clearRestartTimer();
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore cleanup errors
    }
    recognitionRef.current = null;
  }, [clearRestartTimer]);

  return {
    status,
    transcript,
    interimTranscript,
    isSupported,
    error,
    transcriptionWarning,
    start,
    stop,
    reset,
    setTranscript,
    setStatus: setStatusSafe,
  };
}
