import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMicrophoneAnalyser } from '@/hooks/useMicrophoneAnalyser';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { CalendarPlus, Copy, Loader2, Mic, RotateCcw, Sparkles } from 'lucide-react';
import { formatTicketForCopy } from './voiceTicketUtils';
import VoiceSpectrumWave from './VoiceSpectrumWave';

function MetaRow({ label, value }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm text-foreground">{value}</p>
    </div>
  );
}

export default function VoiceTicketDialog({ open, onOpenChange, onApplyToCalendar }) {
  const {
    status,
    transcript,
    interimTranscript,
    isSupported,
    error: speechError,
    transcriptionWarning,
    start,
    stop,
    reset,
    setTranscript,
    setStatus,
  } = useSpeechRecognition();

  const {
    levels,
    isActive: isMicActive,
    isSpeaking,
    error: micError,
    start: startMic,
    stop: stopMic,
  } = useMicrophoneAnalyser();

  const [manualText, setManualText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiReply, setAiReply] = useState('');
  const [ticketDraft, setTicketDraft] = useState(null);
  const [followUpQuestions, setFollowUpQuestions] = useState([]);

  const isListening = isMicActive;
  const effectiveTranscript = (transcript || manualText).trim();
  const displayTranscript = [transcript, interimTranscript].filter(Boolean).join(' ').trim() || manualText;
  const inputError = micError || speechError;

  const resetDialog = () => {
    stop();
    stopMic();
    reset();
    setManualText('');
    setIsProcessing(false);
    setAiReply('');
    setTicketDraft(null);
    setFollowUpQuestions([]);
  };

  useEffect(() => {
    if (!open) {
      stop();
      stopMic();
      return undefined;
    }

    return () => {
      stop();
      stopMic();
    };
  }, [open, stop, stopMic]);

  const handleOpenChange = (nextOpen) => {
    if (!nextOpen) {
      stop();
      stopMic();
      resetDialog();
    }
    onOpenChange(nextOpen);
  };

  const toggleListening = async () => {
    if (isListening || isMicActive) {
      stop();
      stopMic();
      return;
    }

    const micStarted = await startMic();
    if (!micStarted) {
      return;
    }

    if (isSupported) {
      start();
    } else {
      setStatus('listening');
    }
  };

  const generateTicket = async (sourceText) => {
    const trimmed = String(sourceText || '').trim();
    if (!trimmed) {
      toast({
        title: 'No speech detected',
        description: 'Say something or type your note before generating a ticket.',
        variant: 'destructive',
      });
      return;
    }

    stop();
    stopMic();
    setIsProcessing(true);
    setStatus('processing');
    setAiReply('');
    setTicketDraft(null);
    setFollowUpQuestions([]);

    try {
      const response = await base44.ai.generateVoiceTicket(trimmed);

      setAiReply(response.reply || '');
      setTicketDraft(response.ticketDraft || null);
      setFollowUpQuestions(Array.isArray(response.followUpQuestions) ? response.followUpQuestions : []);
      setStatus('idle');
    } catch (err) {
      toast({
        title: 'AI assistant unavailable',
        description: err.message || 'Please try again in a moment.',
        variant: 'destructive',
      });
      setStatus('error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerate = () => {
    const sourceText = isSupported ? effectiveTranscript : manualText.trim();
    generateTicket(sourceText);
  };

  const handleStopAndGenerate = () => {
    stop();
    stopMic();
    const sourceText = isSupported ? effectiveTranscript : manualText.trim();
    generateTicket(sourceText);
  };

  const copyTicket = async () => {
    const text = formatTicketForCopy(ticketDraft);
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: 'Copied ticket',
        description: 'The ticket draft was copied to your clipboard.',
      });
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Could not copy the ticket draft.',
        variant: 'destructive',
      });
    }
  };

  const applyToCalendar = () => {
    if (!ticketDraft) return;
    onApplyToCalendar?.(ticketDraft);
    handleOpenChange(false);
  };

  const tryAgain = () => {
    stop();
    stopMic();
    reset();
    setManualText('');
    setIsProcessing(false);
    setAiReply('');
    setTicketDraft(null);
    setFollowUpQuestions([]);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Voice ticket</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {!ticketDraft && !isProcessing ? (
            <>
              <p className="text-sm text-muted-foreground">
                Record a quick voice note and AI will draft a ticket you can copy or use on your calendar.
              </p>

              {!isSupported ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                  Voice transcription works best in Chrome or Edge. You can still record and type your note below.
                </div>
              ) : null}

              <div
                className={`rounded-xl border p-4 transition-colors ${
                  isListening ? 'border-red-300 bg-red-50/80 dark:border-red-900/50 dark:bg-red-950/20' : 'border-border bg-muted/20'
                }`}
              >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full transition-colors ${
                          isListening
                            ? 'bg-red-500 text-white shadow-[0_0_0_4px_rgba(239,68,68,0.2)]'
                            : 'bg-primary/10 text-primary'
                        }`}
                      >
                        {isListening ? (
                          <VoiceSpectrumWave listening levels={levels} size="sm" className="text-white" barCount={8} />
                        ) : (
                          <Mic className="h-5 w-5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {isListening
                            ? isSpeaking
                              ? 'Recording your voice...'
                              : 'Listening...'
                            : 'Ready to record'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {isListening
                            ? isSpeaking
                              ? 'Voice detected — keep speaking until you are done.'
                              : 'Mic is on. Start speaking when you are ready.'
                            : 'Click record to turn on your microphone.'}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant={isListening ? 'destructive' : 'default'}
                      onClick={toggleListening}
                      className="gap-2 flex-shrink-0"
                    >
                      {isListening ? (
                        <>
                          Stop
                        </>
                      ) : (
                        <>
                          <Mic className="h-4 w-4" />
                          Record
                        </>
                      )}
                    </Button>
                  </div>

                  {isListening ? (
                    <div className="mt-4 flex flex-col items-center gap-2 rounded-lg border border-red-200/80 bg-background/80 px-4 py-4 dark:border-red-900/40">
                      <VoiceSpectrumWave listening levels={levels} className="w-full max-w-xs text-red-500" />
                      <p className="text-xs font-medium text-red-600 dark:text-red-400">
                        {isSpeaking ? 'Voice detected' : 'Waiting for your voice...'}
                      </p>
                    </div>
                  ) : null}

                  <div className="mt-4 min-h-[72px] rounded-lg border border-dashed border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                    {displayTranscript || 'Your transcript will appear here as you speak.'}
                  </div>

                  {isListening ? (
                    <div className="mt-3">
                      <label className="mb-1.5 block text-sm font-medium">Edit transcript</label>
                      <Textarea
                        rows={3}
                        value={transcript}
                        onChange={(event) => setTranscript(event.target.value)}
                        placeholder="Type or edit what you said"
                      />
                    </div>
                  ) : null}
              </div>

              {!isSupported && !isListening ? (
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Your note</label>
                  <Textarea
                    rows={4}
                    value={manualText}
                    onChange={(event) => setManualText(event.target.value)}
                    placeholder="Describe the work you want to log on your calendar..."
                  />
                </div>
              ) : null}

              {inputError ? (
                <p className="text-sm text-destructive">{inputError}</p>
              ) : null}

              {transcriptionWarning ? (
                <p className="text-sm text-amber-700 dark:text-amber-400">{transcriptionWarning}</p>
              ) : null}

              {isSupported && !isListening && effectiveTranscript ? (
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Edit transcript</label>
                  <Textarea
                    rows={3}
                    value={transcript}
                    onChange={(event) => setTranscript(event.target.value)}
                    placeholder="Adjust the transcript if needed"
                  />
                </div>
              ) : null}
            </>
          ) : null}

          {isProcessing ? (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-4 py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">Generating ticket...</p>
                <p className="text-xs text-muted-foreground">AI is writing a proper title and description from your voice note.</p>
              </div>
            </div>
          ) : null}

          {ticketDraft ? (
            <div className="space-y-3">
              {aiReply ? (
                <div className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground whitespace-pre-wrap">
                  {aiReply}
                </div>
              ) : null}

              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Ticket draft</p>
                    <p className="text-xs text-muted-foreground">Copy this ticket or apply it to a new calendar entry.</p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${ticketDraft.readyToLog ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}
                  >
                    {ticketDraft.readyToLog ? 'Ready to use' : 'Needs review'}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <MetaRow label="Title" value={ticketDraft.title || 'Waiting for title'} />
                  <MetaRow label="Priority" value={ticketDraft.priority || 'medium'} />
                  <MetaRow label="Project" value={ticketDraft.projectName || 'Not linked'} />
                  <MetaRow
                    label="Timeframe"
                    value={ticketDraft.dueDate || ticketDraft.timeframeLabel || 'Waiting for timeframe'}
                  />
                  <MetaRow
                    label="Estimated Hours"
                    value={ticketDraft.estimatedHours ? `${ticketDraft.estimatedHours}h` : 'Not set'}
                  />
                </div>

                <div className="mt-3 rounded-lg bg-background px-3 py-2 text-sm text-muted-foreground">
                  {ticketDraft.description || 'No ticket description yet.'}
                </div>

                {followUpQuestions.length ? (
                  <div className="mt-3 space-y-1">
                    {followUpQuestions.map((question) => (
                      <p key={question} className="text-xs text-muted-foreground">
                        - {question}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <div>
            {ticketDraft ? (
              <Button type="button" variant="outline" onClick={tryAgain} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Try again
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>

            {!ticketDraft && !isProcessing ? (
              isListening || isMicActive ? (
                <Button type="button" onClick={handleStopAndGenerate} className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  Stop and generate
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!effectiveTranscript}
                  className="gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  Generate ticket
                </Button>
              )
            ) : null}

            {ticketDraft ? (
              <>
                <Button type="button" variant="outline" onClick={copyTicket} className="gap-2">
                  <Copy className="h-4 w-4" />
                  Copy ticket
                </Button>
                <Button type="button" onClick={applyToCalendar} className="gap-2">
                  <CalendarPlus className="h-4 w-4" />
                  Use on calendar
                </Button>
              </>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
