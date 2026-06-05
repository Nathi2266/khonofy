import { env } from '../config/env.js';

const VALID_PRIORITIES = new Set(['low', 'medium', 'high', 'urgent']);

function normalizeText(value) {
  return String(value || '').trim();
}

function stripCodeFence(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed.startsWith('```')) return trimmed;
  return trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

function projectListForPrompt(projects) {
  if (!projects.length) return '- No active projects were found for this user.';
  return projects
    .slice(0, 20)
    .map((project) => `- ${project.name}${project.clientName ? ` (client: ${project.clientName})` : ''}${project.departmentId ? ` [department: ${project.departmentId}]` : ''}`)
    .join('\n');
}

function buildSystemPrompt(user, projects) {
  return [
    'You are the Khonofy AI assistant for an internal productivity platform.',
    'Your job is to help users draft useful work artifacts for this application: project plans, milestones, task checklists, timesheet summaries, meeting notes, reports, and ticket drafts.',
    'Always stay practical, concise, and action-oriented.',
    'Do not use markdown tables.',
    'When the user wants to create a ticket/task, gather or infer these fields before marking it ready to log: title, work description, and timeframe. Optional fields: priority, estimated hours, project.',
    'If key ticket information is missing, ask direct follow-up questions in the reply and keep ticketDraft.readyToLog false.',
    'If enough information is present, summarize the ticket clearly and tell the user they can click Log Ticket.',
    'Keep the response focused on the Khonofy application and work-management use cases.',
    '',
    `Current user role: ${user?.role || 'staff'}`,
    `Current user name: ${user?.fullName || user?.email || 'Unknown user'}`,
    `Current user department: ${user?.departmentId || 'Not assigned'}`,
    '',
    'Available active projects for this user:',
    projectListForPrompt(projects),
    '',
    'Return valid JSON only with this exact shape:',
    '{',
    '  "reply": "string",',
    '  "ticketDraft": {',
    '    "title": "string or empty",',
    '    "description": "string or empty",',
    '    "timeframeLabel": "string or empty",',
    '    "dueDate": "YYYY-MM-DD or null",',
    '    "priority": "low|medium|high|urgent",',
    '    "estimatedHours": "number or null",',
    '    "projectId": "string or empty",',
    '    "projectName": "string or empty",',
    '    "readyToLog": true',
    '  } OR null,',
    '  "followUpQuestions": ["string", "string"]',
    '}',
  ].join('\n');
}

function normalizeMessages(messages) {
  return (Array.isArray(messages) ? messages : [])
    .filter((message) => ['user', 'assistant', 'system'].includes(message?.role))
    .slice(-12)
    .map((message) => ({
      role: message.role,
      content: normalizeText(message.content).slice(0, 4000),
    }))
    .filter((message) => message.content);
}

function matchProject(ticketDraft, projects) {
  if (!ticketDraft) return null;

  if (ticketDraft.projectId) {
    const byId = projects.find((project) => project.id === ticketDraft.projectId);
    if (byId) return byId;
  }

  const normalizedProjectName = normalizeText(ticketDraft.projectName).toLowerCase();
  if (!normalizedProjectName) return null;

  return projects.find((project) => normalizeText(project.name).toLowerCase() === normalizedProjectName) || null;
}

function normalizeTicketDraft(ticketDraft, projects) {
  if (!ticketDraft || typeof ticketDraft !== 'object') return null;

  const matchedProject = matchProject(ticketDraft, projects);
  const title = normalizeText(ticketDraft.title);
  const description = normalizeText(ticketDraft.description);
  const timeframeLabel = normalizeText(ticketDraft.timeframeLabel);
  const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(String(ticketDraft.dueDate || '')) ? ticketDraft.dueDate : null;
  const estimatedHours = Number(ticketDraft.estimatedHours);
  const priority = VALID_PRIORITIES.has(ticketDraft.priority) ? ticketDraft.priority : 'medium';
  const readyToLog = Boolean(title && description && (timeframeLabel || dueDate) && ticketDraft.readyToLog);

  return {
    title,
    description,
    timeframeLabel,
    dueDate,
    priority,
    estimatedHours: Number.isFinite(estimatedHours) && estimatedHours > 0 ? estimatedHours : null,
    projectId: matchedProject?.id || normalizeText(ticketDraft.projectId) || '',
    projectName: matchedProject?.name || normalizeText(ticketDraft.projectName) || '',
    readyToLog,
  };
}

function parseJsonResponse(content) {
  const clean = stripCodeFence(content);
  return JSON.parse(clean);
}

export function isAiConfigured() {
  return Boolean(env.azureOpenAiApiKey && env.azureOpenAiEndpoint && env.azureOpenAiModel);
}

function buildUserImportPrompt() {
  return [
    'You extract structured employee/user records from HR onboarding or user-import documents.',
    'The input may be CSV-like text, a PDF export, a Word document, an Excel spreadsheet, plain text, or a photo/scan of a user list.',
    'Return valid JSON only with this exact shape:',
    '{',
    '  "users": [',
    '    {',
    '      "fullName": "string",',
    '      "email": "string",',
    '      "department": "string",',
    '      "designation": "string"',
    '    }',
    '  ],',
    '  "summary": "string"',
    '}',
    'Rules:',
    '- Extract every user row you can find, including rows that repeat the same name or email.',
    '- Do not deduplicate users by email or name.',
    '- Each user must include fullName, email, department, and designation.',
    '- Skip header rows, page titles, totals, and non-user metadata.',
    '- Preserve department and designation names exactly as written in the document.',
    '- Existing departments and designations in the app will be reused by name; do not invent duplicate tag names.',
    '- Use lowercase emails when possible.',
    '- If a row is missing any required field, omit that row.',
    '- summary should briefly state how many users were found.',
  ].join('\n');
}

function normalizeParsedImportUser(user) {
  if (!user || typeof user !== 'object') return null;

  const fullName = normalizeText(user.fullName || user.full_name || user.name);
  const email = normalizeText(user.email).toLowerCase();
  const department = normalizeText(user.department);
  const designation = normalizeText(user.designation);

  if (!fullName || !email || !department || !designation) return null;

  return { fullName, email, department, designation };
}

function normalizeParsedImportUsers(users) {
  return (Array.isArray(users) ? users : [])
    .map(normalizeParsedImportUser)
    .filter(Boolean);
}

export async function parseUsersFromImportDocument({
  text = '',
  fileName = '',
  imageBase64 = '',
  imageMimeType = '',
}) {
  if (!isAiConfigured()) {
    throw new Error('AI assistant is not configured on the server');
  }

  const hasImage = Boolean(imageBase64 && imageMimeType);
  const documentText = normalizeText(text).slice(0, 50000);
  if (!hasImage && !documentText) {
    throw new Error('The uploaded document is empty');
  }

  const endpoint = env.azureOpenAiEndpoint.replace(/\/$/, '');
  const userMessage = hasImage
    ? {
        role: 'user',
        content: [
          {
            type: 'text',
            text: [
              fileName ? `File name: ${fileName}` : '',
              'This image contains a user import document. Read all visible text and extract user records from the photo or scan.',
            ].filter(Boolean).join('\n\n'),
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${imageMimeType};base64,${imageBase64}`,
            },
          },
        ],
      }
    : {
        role: 'user',
        content: [
          fileName ? `File name: ${fileName}` : '',
          'Document contents:',
          documentText,
        ].filter(Boolean).join('\n\n'),
      };

  const response = await fetch(
    `${endpoint}/openai/deployments/${encodeURIComponent(env.azureOpenAiModel)}/chat/completions?api-version=${encodeURIComponent(env.azureOpenAiApiVersion)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': env.azureOpenAiApiKey,
      },
      body: JSON.stringify({
        temperature: 0.1,
        max_completion_tokens: 4000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: buildUserImportPrompt() },
          userMessage,
        ],
      }),
    },
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || data?.message || 'Azure OpenAI request failed';
    throw new Error(message);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('No AI response content received');
  }

  const parsed = parseJsonResponse(content);
  const users = normalizeParsedImportUsers(parsed.users);
  if (!users.length) {
    throw new Error(
      'AI could not find complete user records. Each row needs full name, email, department, and designation.',
    );
  }

  return {
    users,
    summary: normalizeText(parsed.summary) || `Found ${users.length} user${users.length === 1 ? '' : 's'}.`,
  };
}

export async function generateAssistantReply({ user, messages, projects = [] }) {
  if (!isAiConfigured()) {
    throw new Error('AI assistant is not configured on the server');
  }

  const endpoint = env.azureOpenAiEndpoint.replace(/\/$/, '');
  const response = await fetch(
    `${endpoint}/openai/deployments/${encodeURIComponent(env.azureOpenAiModel)}/chat/completions?api-version=${encodeURIComponent(env.azureOpenAiApiVersion)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': env.azureOpenAiApiKey,
      },
      body: JSON.stringify({
        temperature: 0.3,
        max_completion_tokens: 1200,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: buildSystemPrompt(user, projects) },
          ...normalizeMessages(messages),
        ],
      }),
    }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || data?.message || 'Azure OpenAI request failed';
    throw new Error(message);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('No AI response content received');
  }

  const parsed = parseJsonResponse(content);
  return {
    reply: normalizeText(parsed.reply) || 'I could not prepare a response just now.',
    followUpQuestions: Array.isArray(parsed.followUpQuestions)
      ? parsed.followUpQuestions.map((question) => normalizeText(question)).filter(Boolean)
      : [],
    ticketDraft: normalizeTicketDraft(parsed.ticketDraft, projects),
  };
}
