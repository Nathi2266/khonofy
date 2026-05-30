import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function getWeekBounds() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon...
  const diffToMon = (day === 0 ? -6 : 1 - day);
  const mon = new Date(now);
  mon.setDate(now.getDate() + diffToMon);
  const fri = new Date(mon);
  fri.setDate(mon.getDate() + 4);
  return {
    weekStart: mon.toISOString().split('T')[0],
    weekEnd: fri.toISOString().split('T')[0],
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow scheduled calls (no user) or admin calls
    let isAuthorized = false;
    try {
      const user = await base44.auth.me();
      isAuthorized = user?.role === 'admin' || user?.role === 'superuser';
    } catch {
      // Called from automation (no user token) — allow via service role
      isAuthorized = true;
    }

    if (!isAuthorized) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { weekStart, weekEnd } = getWeekBounds();

    // Get all staff users
    const allUsers = await base44.asServiceRole.entities.User.list();
    const staffUsers = allUsers.filter(u => u.role === 'staff' || u.role === 'user');

    // Get timesheets submitted for this week (pending or approved)
    const submittedTimesheets = await base44.asServiceRole.entities.Timesheet.filter({
      week_start: weekStart,
    });

    const submittedUserIds = new Set(
      submittedTimesheets
        .filter(t => t.status === 'pending' || t.status === 'approved')
        .map(t => t.user_id)
    );

    // Find staff who haven't submitted
    const unsubmitted = staffUsers.filter(u => !submittedUserIds.has(u.id));

    const results = [];
    for (const member of unsubmitted) {
      if (!member.email) continue;
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: member.email,
        subject: '⏰ Reminder: Please submit your timesheet',
        body: `Hi ${member.full_name || 'there'},\n\nThis is a friendly reminder that your timesheet for the week of ${weekStart} to ${weekEnd} hasn't been submitted yet.\n\nPlease log into Khonofy and submit it before the end of today.\n\nThank you!`,
      });
      results.push(member.email);
    }

    return Response.json({
      success: true,
      week: { weekStart, weekEnd },
      reminders_sent: results.length,
      recipients: results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});