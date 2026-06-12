import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Copy, FilePlus2, MessageSquareText, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import PageHeader from '@/components/PageHeader';
import PageShell from '@/components/PageShell';
import DashboardIcon, { DASHBOARD_ICON_SIZES } from '@/components/DashboardIcon';
import aiAvatar from '@/assets/images/Ai_Avatar.gif';
import dashboardIcon2 from '@/assets/images/dashboard/2.png';
import dashboardIcon4 from '@/assets/images/dashboard/4.png';
import dashboardIcon10 from '@/assets/images/dashboard/10.png';
import dashboardIcon11 from '@/assets/images/dashboard/11.png';
import dashboardIcon16 from '@/assets/images/dashboard/16.png';
import { useCurrentUser } from '@/hooks/useCurrentUser';

const QUICK_ACTIONS = [
  {
    title: 'Create a project plan',
    description: 'Generate milestones, owners, and delivery steps.',
    iconSrc: dashboardIcon2,
    prompt: 'Create a project plan for a new internal rollout with milestones, risks, and next actions.',
  },
  {
    title: 'Draft a task checklist',
    description: 'Break big work into smaller executable steps.',
    iconSrc: dashboardIcon4,
    prompt: 'Turn a large task into a practical checklist with dependencies and acceptance criteria.',
  },
  {
    title: 'Write a timesheet summary',
    description: 'Prepare a clean weekly or daily work summary.',
    iconSrc: dashboardIcon10,
    prompt: 'Write a concise weekly timesheet summary that I can adapt before submission.',
  },
  {
    title: 'Prepare a report outline',
    description: 'Structure updates, reports, and leadership summaries.',
    iconSrc: dashboardIcon11,
    prompt: 'Create a management report outline with sections for progress, blockers, risks, and next steps.',
  },
  {
    title: 'Create a ticket draft',
    description: 'Prepare a task ticket that can be logged into Khonofy.',
    iconSrc: dashboardIcon4,
    prompt: 'Help me create a ticket. Gather the ticket name, what needs to be done, and the timeframe before marking it ready to log.',
  },
];

function createMessage(role, content, extra = {}) {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
    ticketDraft: null,
    followUpQuestions: [],
    loggedTaskId: '',
    loggedTaskTitle: '',
    isError: false,
    ...extra,
  };
}

function createWelcomeMessage(user) {
  const name = user?.full_name || user?.email || 'there';
  return createMessage(
    'assistant',
    `Hi ${name}. I am your Khonofy AI workspace.\n\nAsk me to draft project plans, milestones, ticket outlines, checklists, timesheet summaries, meeting notes, or reports for this application. When a ticket draft is ready, you can log it directly into Khonofy.`
  );
}

export default function AIAssistant() {
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();
  const bottomRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [isResponding, setIsResponding] = useState(false);
  const [loggingMessageId, setLoggingMessageId] = useState('');

  const storageKey = useMemo(
    () => (user?.id ? `khonofy-ai-chat:${user.id}` : null),
    [user?.id]
  );

  useEffect(() => {
    if (!storageKey) return;
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      setMessages([createWelcomeMessage(user)]);
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      setMessages(Array.isArray(parsed) && parsed.length ? parsed : [createWelcomeMessage(user)]);
    } catch {
      setMessages([createWelcomeMessage(user)]);
    }
  }, [storageKey, user]);

  useEffect(() => {
    if (!storageKey || !messages.length) return;
    window.localStorage.setItem(storageKey, JSON.stringify(messages));
  }, [messages, storageKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isResponding]);

  const lastAssistantMessage = [...messages].reverse().find((message) => message.role === 'assistant');

  const submitPrompt = async (nextPrompt = draft) => {
    const trimmed = String(nextPrompt || '').trim();
    if (!trimmed || !user || isResponding) return;

    const userMessage = createMessage('user', trimmed);
    const nextConversation = [...messages, userMessage];
    setMessages(nextConversation);
    setDraft('');
    setIsResponding(true);

    try {
      const response = await base44.ai.chat(nextConversation);
      const assistantMessage = createMessage('assistant', response.reply, {
        ticketDraft: response.ticketDraft || null,
        followUpQuestions: response.followUpQuestions || [],
      });
      setMessages((current) => [...current, assistantMessage]);
    } catch (error) {
      const errorMessage = createMessage(
        'assistant',
        error.message || 'I could not reach the AI service right now. Please try again.',
        { isError: true }
      );
      setMessages((current) => [...current, errorMessage]);
      toast({
        title: 'AI assistant unavailable',
        description: error.message || 'Please try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setIsResponding(false);
    }
  };

  const clearConversation = () => {
    const nextMessages = [createWelcomeMessage(user)];
    setMessages(nextMessages);
    if (storageKey) window.localStorage.setItem(storageKey, JSON.stringify(nextMessages));
  };

  const copyLatestReply = async () => {
    if (!lastAssistantMessage?.content) return;
    try {
      await navigator.clipboard.writeText(lastAssistantMessage.content);
      toast({
        title: 'Copied response',
        description: 'The latest AI draft was copied to your clipboard.',
      });
    } catch {
      toast({
        title: 'Copy failed',
        description: 'Could not copy the latest response.',
        variant: 'destructive',
      });
    }
  };

  const logTicket = async (message) => {
    if (!message?.ticketDraft?.readyToLog || loggingMessageId) return;

    setLoggingMessageId(message.id);
    try {
      const task = await base44.ai.logTicket(message.ticketDraft);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['myTasks'] });
      queryClient.invalidateQueries({ queryKey: ['allTasks'] });
      queryClient.invalidateQueries({ queryKey: ['recentLogs'] });

      setMessages((current) => current.map((entry) => (
        entry.id === message.id
          ? {
              ...entry,
              loggedTaskId: task.id,
              loggedTaskTitle: task.title,
            }
          : entry
      )));

      toast({
        title: 'Ticket logged',
        description: `"${task.title}" was added to Khonofy successfully.`,
      });
    } catch (error) {
      toast({
        title: 'Could not log ticket',
        description: error.message || 'Please review the draft and try again.',
        variant: 'destructive',
      });
    } finally {
      setLoggingMessageId('');
    }
  };

  return (
    <PageShell className="flex min-h-full flex-col gap-6">
      <PageHeader
        title="AI Assistant"
        description="A global Khonofy workspace for Azure-backed drafting, planning, ticket creation, and work summaries in light or dark mode."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" onClick={copyLatestReply} disabled={!lastAssistantMessage}>
              <Copy className="mr-2 h-4 w-4" />
              Copy Reply
            </Button>
            <Button variant="outline" onClick={clearConversation}>
              <Trash2 className="mr-2 h-4 w-4" />
              Clear Chat
            </Button>
          </div>
        }
      />

      <div className="flex min-h-[78vh] flex-col overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2">
              <img src={aiAvatar} alt="" className="h-8 w-8 rounded-lg object-cover" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Conversation</h2>
              <p className="text-sm text-muted-foreground">Ask about this application, draft content, or create a ticket that can be logged into the system.</p>
            </div>
          </div>
        </div>

        <div className="border-b border-border bg-muted/20 px-5 py-4">
          <div className="mb-3 flex items-center gap-2">
            <DashboardIcon src={dashboardIcon16} className={DASHBOARD_ICON_SIZES.section} />
            <h3 className="text-sm font-semibold text-foreground">Quick starts</h3>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.title}
                  type="button"
                  className="rounded-xl border border-border bg-background p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                  onClick={() => submitPrompt(action.prompt)}
                  disabled={isResponding}
                >
                  <div className="mb-2 inline-flex rounded-lg bg-primary/10 p-2">
                    <DashboardIcon src={action.iconSrc} className={DASHBOARD_ICON_SIZES.section} />
                  </div>
                  <p className="text-sm font-medium text-foreground">{action.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{action.description}</p>
                </button>
            ))}
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className="max-w-3xl">
                <div
                  className={`rounded-2xl px-4 py-3 text-sm shadow-sm ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : message.isError
                        ? 'border border-destructive/30 bg-destructive/5 text-foreground'
                        : 'border border-border bg-background text-foreground'
                  }`}
                >
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide opacity-70">
                    {message.role === 'user' ? 'You' : 'AI Assistant'}
                  </p>
                  <div className="whitespace-pre-wrap leading-6">{message.content}</div>
                  {message.followUpQuestions?.length ? (
                    <div className="mt-3 space-y-1">
                      {message.followUpQuestions.map((question) => (
                        <p key={question} className="text-xs text-muted-foreground">
                          - {question}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>

                {message.role === 'assistant' && message.ticketDraft ? (
                  <div className="mt-3 rounded-xl border border-border bg-muted/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Ticket Draft</p>
                        <p className="text-xs text-muted-foreground">Review this draft before logging it into Khonofy.</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${message.ticketDraft.readyToLog ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {message.ticketDraft.readyToLog ? 'Ready to log' : 'Needs more info'}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <MetaRow label="Title" value={message.ticketDraft.title || 'Waiting for title'} />
                      <MetaRow label="Priority" value={message.ticketDraft.priority || 'medium'} />
                      <MetaRow label="Project" value={message.ticketDraft.projectName || 'Not linked'} />
                      <MetaRow label="Timeframe" value={message.ticketDraft.dueDate || message.ticketDraft.timeframeLabel || 'Waiting for timeframe'} />
                      <MetaRow label="Estimated Hours" value={message.ticketDraft.estimatedHours ? `${message.ticketDraft.estimatedHours}h` : 'Not set'} />
                    </div>

                    <div className="mt-3 rounded-lg bg-background px-3 py-2 text-sm text-muted-foreground">
                      {message.ticketDraft.description || 'No ticket description yet.'}
                    </div>

                    <div className="mt-3 flex items-center justify-end">
                      {message.loggedTaskId ? (
                        <span className="text-sm font-medium text-emerald-700">
                          Logged as "{message.loggedTaskTitle}"
                        </span>
                      ) : (
                        <Button
                          onClick={() => logTicket(message)}
                          disabled={!message.ticketDraft.readyToLog || loggingMessageId === message.id}
                        >
                          <FilePlus2 className="mr-2 h-4 w-4" />
                          {loggingMessageId === message.id ? 'Logging...' : 'Log Ticket'}
                        </Button>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ))}

          {isResponding ? (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground shadow-sm">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide opacity-70">AI Assistant</p>
                Drafting a response...
              </div>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-border px-5 py-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <MessageSquareText className="h-4 w-4 text-primary" />
              Ask the assistant anything about this application
            </div>
            <Textarea
              rows={4}
              placeholder="Ask for a project plan, milestones, a ticket draft, a task checklist, a timesheet summary, meeting notes, or any other work draft..."
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  submitPrompt();
                }
              }}
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Quick actions are above the field. Press `Enter` to send and `Shift+Enter` for a new line.
              </p>
              <Button onClick={() => submitPrompt()} disabled={!draft.trim() || isResponding}>
                <Send className="mr-2 h-4 w-4" />
                Send
              </Button>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function MetaRow({ label, value }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm text-foreground">{value}</p>
    </div>
  );
}
