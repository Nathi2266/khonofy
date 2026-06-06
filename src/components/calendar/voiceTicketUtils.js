export function buildCalendarFormFromTicket(ticketDraft, baseForm, projects = []) {
  if (!ticketDraft || !baseForm) return baseForm;

  const project =
    projects.find((item) => item.id === ticketDraft.projectId) ||
    projects.find(
      (item) =>
        ticketDraft.projectName &&
        String(item.name || '').toLowerCase() === String(ticketDraft.projectName).toLowerCase()
    );

  const timeframe = ticketDraft.dueDate || ticketDraft.timeframeLabel;
  let description = ticketDraft.description || '';
  if (timeframe) {
    description = description ? `${description}\nTimeframe: ${timeframe}` : `Timeframe: ${timeframe}`;
  }

  const estimatedHours = Number(ticketDraft.estimatedHours);
  const endAt =
    Number.isFinite(estimatedHours) && estimatedHours > 0
      ? new Date(baseForm.start_at.getTime() + estimatedHours * 60 * 60 * 1000)
      : baseForm.end_at;

  return {
    ...baseForm,
    task_title: ticketDraft.title || '',
    description,
    project_id: project?.id || ticketDraft.projectId || '',
    project_name: project?.name || ticketDraft.projectName || '',
    project_color: project?.color || '',
    client_id: project?.client_id || baseForm.client_id || '',
    client_name: project?.client_name || baseForm.client_name || '',
    billable: project ? Boolean(project.is_billable_default) : baseForm.billable,
    end_at: endAt,
  };
}

export function formatTicketForCopy(ticketDraft) {
  if (!ticketDraft) return '';

  const lines = [
    `Title: ${ticketDraft.title || ''}`,
    `Description: ${ticketDraft.description || ''}`,
    `Project: ${ticketDraft.projectName || 'Not linked'}`,
    `Timeframe: ${ticketDraft.dueDate || ticketDraft.timeframeLabel || ''}`,
    `Priority: ${ticketDraft.priority || 'medium'}`,
  ];

  if (ticketDraft.estimatedHours) {
    lines.push(`Estimated hours: ${ticketDraft.estimatedHours}`);
  }

  return lines.filter((line) => !line.endsWith(': ')).join('\n');
}
