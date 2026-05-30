import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function getWeekBounds() {
  const now = new Date();
  const day = now.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const mon = new Date(now);
  mon.setDate(now.getDate() + diffToMon);
  const fri = new Date(mon);
  fri.setDate(mon.getDate() + 4);
  return {
    weekStart: mon.toISOString().split('T')[0],
    weekEnd: fri.toISOString().split('T')[0],
  };
}

async function graphGet(url, accessToken) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  });
  return res.json();
}

async function postMessage(teamId, channelId, accessToken, content) {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/teams/${teamId}/channels/${channelId}/messages`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: { contentType: 'html', content } }),
    }
  );
  return res.json();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow automation (no user) or admin calls
    try {
      const user = await base44.auth.me();
      if (user && user.role !== 'admin' && user.role !== 'superuser') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    } catch {
      // Called from automation without user token — allowed
    }

    const { weekStart, weekEnd } = getWeekBounds();

    // Get Microsoft Teams access token
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('microsoft_teams');

    // List all joined teams
    const teamsData = await graphGet('https://graph.microsoft.com/v1.0/me/joinedTeams', accessToken);
    const teams = teamsData.value || [];

    if (teams.length === 0) {
      return Response.json({ success: false, message: 'No Teams found for this account.' });
    }

    const reminderHtml = `
      <p>👋 <strong>Weekly Timesheet Reminder</strong></p>
      <p>Please make sure to submit your timesheet for the week of <strong>${weekStart}</strong> to <strong>${weekEnd}</strong> before end of day.</p>
      <p>Log in to <strong>Khonofy</strong> → My Timesheets → Submit. Thank you! ✅</p>
    `;

    const results = [];

    for (const team of teams) {
      // Get channels for this team
      const channelsData = await graphGet(
        `https://graph.microsoft.com/v1.0/teams/${team.id}/channels`,
        accessToken
      );
      const channels = channelsData.value || [];

      // Post to the "General" channel, or fall back to the first channel
      const generalChannel =
        channels.find(c => c.displayName.toLowerCase() === 'general') || channels[0];

      if (!generalChannel) continue;

      const msg = await postMessage(team.id, generalChannel.id, accessToken, reminderHtml);
      results.push({
        team: team.displayName,
        channel: generalChannel.displayName,
        messageId: msg.id || null,
      });
    }

    return Response.json({
      success: true,
      week: { weekStart, weekEnd },
      posted_to: results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});