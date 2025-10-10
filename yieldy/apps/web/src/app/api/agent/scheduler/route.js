import sql from "@/app/api/utils/sql";

// Scheduler endpoint: checks last scan and triggers scans/rebalance when due
export async function POST(request) {
  try {
    // Read optional body but don't require it
    let body = {};
    try {
      body = await request.json();
    } catch (e) {}

    // Get config
    const configRows = await sql`SELECT * FROM agent_config ORDER BY id DESC LIMIT 1`;
    if (!configRows || configRows.length === 0) {
      return Response.json({ success: false, scheduled: false, reason: "no-config" }, { status: 200 });
    }
    const config = configRows[0];

    // Determine interval (default 24h)
    const intervalMinutes = Number(config.scan_interval_minutes || 1440);

    // Find last completed scan time
    const lastRows = await sql`
      SELECT scan_completed_at FROM scan_logs
      WHERE status = 'completed' AND scan_completed_at IS NOT NULL
      ORDER BY scan_completed_at DESC
      LIMIT 1
    `;
    const now = new Date();
    let due = false;
    if (!lastRows || lastRows.length === 0) {
      due = true;
    } else {
      const last = new Date(lastRows[0].scan_completed_at);
      const diffMs = now.getTime() - last.getTime();
      const diffMin = diffMs / (60 * 1000);
      due = diffMin >= intervalMinutes;
    }

    if (!due) {
      return Response.json({ success: true, scheduled: false, nextCheckMinutes: Math.max(0, intervalMinutes) }, { status: 200 });
    }

    // First: refresh opportunities quickly regardless of auto-invest setting
    try {
      const resScanOnly = await fetch("/api/agent/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockchain: "both", scanOnly: true }),
      });
      // Ignore if fails, we'll continue
      if (!resScanOnly.ok) {
        // no-op
      }
    } catch (e) {}

    // If auto invest enabled, run a fast investing pass with rebalance (forceRun speeds up decisions)
    let invested = false;
    if (config.auto_invest_enabled) {
      try {
        const resInvest = await fetch("/api/agent/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blockchain: "both", forceRun: true }),
        });
        invested = resInvest.ok;
      } catch (e) {
        invested = false;
      }
    }

    return Response.json({ success: true, scheduled: true, invested }, { status: 200 });
  } catch (error) {
    console.error("scheduler error", error);
    return Response.json({ success: false, error: "scheduler-failed" }, { status: 500 });
  }
}
