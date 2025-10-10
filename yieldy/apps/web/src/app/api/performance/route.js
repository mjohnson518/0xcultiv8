import sql from "@/app/api/utils/sql";
import { rateLimitMiddleware } from "@/app/api/middleware/rateLimit";

export async function GET(request) {
  // Rate limiting - general tier
  const rateLimitError = await rateLimitMiddleware(request, 'general');
  if (rateLimitError) return rateLimitError;

  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "90", 10);
    const bucketParam = (searchParams.get("bucket") || "day").toLowerCase();
    const baseCurrency = (
      searchParams.get("baseCurrency") || "USD"
    ).toUpperCase();
    const compareCurrency = (
      searchParams.get("compareCurrency") || ""
    ).toUpperCase();

    // Validate bucket to prevent SQL injection; allow only day/week/month
    const bucket =
      bucketParam === "week"
        ? "week"
        : bucketParam === "month"
          ? "month"
          : "day";

    // Compute KPIs
    // Total capital currently at work: pending + confirmed
    const [capitalAtWork, realizedRows, realizedBaseRows, openPositions] =
      await sql.transaction((txn) => [
        txn`SELECT COALESCE(SUM(amount),0) AS total_invested FROM investments WHERE status IN ('pending','confirmed')`,
        txn`SELECT COALESCE(SUM(actual_return),0) AS realized_return FROM investments WHERE withdrawn_at IS NOT NULL AND actual_return IS NOT NULL`,
        txn`SELECT COALESCE(SUM(amount),0) AS realized_invested FROM investments WHERE withdrawn_at IS NOT NULL`,
        // Open positions to compute accrued (unrealized) PnL pro‑rata by expected_apy
        txn`SELECT amount, expected_apy, invested_at FROM investments WHERE withdrawn_at IS NULL AND status IN ('pending','confirmed')`,
      ]);

    const totalInvested = parseFloat(capitalAtWork[0]?.total_invested || 0);
    const realizedReturnOnly = parseFloat(
      realizedRows[0]?.realized_return || 0,
    );
    const realizedInvestedOnly = parseFloat(
      realizedBaseRows[0]?.realized_invested || 0,
    );

    // Accrued PnL for open positions (simple pro‑rata of APY by days held)
    let accruedReturn = 0;
    let openPrincipal = 0;
    const now = Date.now();
    for (const row of openPositions) {
      const amt = Number(row.amount || 0);
      const apy = Number(row.expected_apy || 0); // percent
      const investedAt = row.invested_at
        ? new Date(row.invested_at).getTime()
        : now;
      const daysHeld = Math.max(0, (now - investedAt) / (1000 * 60 * 60 * 24));
      const prorated = amt * (apy / 100) * (daysHeld / 365);
      accruedReturn += isFinite(prorated) ? prorated : 0;
      openPrincipal += isFinite(amt) ? amt : 0;
    }

    // Combine realized + accrued for dynamic KPIs the user expects to move while holding
    const combinedReturn = realizedReturnOnly + accruedReturn;
    const combinedInvested = realizedInvestedOnly + openPrincipal;
    const nominalRoiPct =
      combinedInvested > 0 ? (combinedReturn / combinedInvested) * 100 : 0;

    // Inflation adjustment (real ROI)
    const minDays = Number.isFinite(days) && days > 0 ? days : 90;
    let annualInflationPct = 3.0; // default fallback

    // Optional: read an env override for inflation if provided
    if (process && process.env && process.env.DEFAULT_ANNUAL_INFLATION_PCT) {
      const parsed = Number(process.env.DEFAULT_ANNUAL_INFLATION_PCT);
      if (isFinite(parsed) && parsed >= 0 && parsed < 100) {
        annualInflationPct = parsed;
      }
    }

    // If CPI API configured, attempt to fetch a more accurate period inflation percentage
    let inflationPctForWindow = (annualInflationPct * minDays) / 365;
    try {
      const cpiUrl = process?.env?.CPI_API_URL || ""; // e.g. points to a service returning { pct: number } over date range
      const cpiKey = process?.env?.CPI_API_KEY || "";
      if (cpiUrl) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - (minDays - 1));
        const url = `${cpiUrl}?start=${startDate.toISOString().slice(0, 10)}&end=${endDate.toISOString().slice(0, 10)}`;
        const headers = cpiKey
          ? { Authorization: `Bearer ${cpiKey}` }
          : undefined;
        const resp = await fetch(url, { headers });
        if (resp.ok) {
          const json = await resp.json();
          const pct = Number(json?.pct);
          if (isFinite(pct)) {
            inflationPctForWindow = pct;
          }
        }
      }
    } catch (e) {
      // gracefully fallback to default
      console.error("CPI fetch failed, using default inflation", e);
    }

    const realRoiPct = (function () {
      const rn = nominalRoiPct / 100;
      const inf = inflationPctForWindow / 100;
      const real = (1 + rn) / (1 + inf) - 1;
      return real * 100;
    })();

    // Build series query dynamically for bucket aggregation (keep realized-only series for stability)
    const dateTrunc = bucket; // safe validated literal

    const seriesQuery = `
      WITH bounds AS (
        SELECT (current_date - $1::int + 1)::date AS start_day, current_date::date AS end_day
      ),
      periods AS (
        SELECT generate_series(
          date_trunc('${dateTrunc}', b.start_day::timestamp),
          date_trunc('${dateTrunc}', b.end_day::timestamp),
          '1 ${dateTrunc}'::interval
        )::date AS period_start
        FROM bounds b
      ),
      invested AS (
        SELECT date_trunc('${dateTrunc}', invested_at)::date AS period_start, SUM(amount) AS invested
        FROM investments
        WHERE invested_at >= (SELECT start_day FROM bounds)
        GROUP BY 1
      ),
      realized AS (
        SELECT date_trunc('${dateTrunc}', withdrawn_at)::date AS period_start, SUM(actual_return) AS realized
        FROM investments
        WHERE withdrawn_at IS NOT NULL AND actual_return IS NOT NULL AND withdrawn_at >= (SELECT start_day FROM bounds)
        GROUP BY 1
      )
      SELECT p.period_start AS day,
             COALESCE(i.invested, 0) AS invested,
             COALESCE(r.realized, 0) AS realized
      FROM periods p
      LEFT JOIN invested i ON i.period_start = p.period_start
      LEFT JOIN realized r ON r.period_start = p.period_start
      ORDER BY p.period_start ASC
    `;

    const series = await sql(seriesQuery, [minDays]);

    // FX comparison (optional)
    let fx = null;
    if (compareCurrency && compareCurrency !== baseCurrency) {
      try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - (minDays - 1));
        const qs = new URLSearchParams({
          start_date: startDate.toISOString().slice(0, 10),
          end_date: endDate.toISOString().slice(0, 10),
          base: baseCurrency,
          symbols: compareCurrency,
        }).toString();
        const url = `https://api.exchangerate.host/timeseries?${qs}`;
        const resp = await fetch(url);
        if (resp.ok) {
          const json = await resp.json();
          const rates = json?.rates || {};
          const ordered = Object.keys(rates).sort();
          const fxSeries = ordered.map((d) => ({
            date: d,
            rate: Number(rates[d]?.[compareCurrency]),
          }));
          const first = fxSeries[0]?.rate;
          const last = fxSeries[fxSeries.length - 1]?.rate;
          const changePct = first && last ? ((last - first) / first) * 100 : 0;
          fx = {
            pair: `${baseCurrency}/${compareCurrency}`,
            changePct,
            series: fxSeries,
          };
        }
      } catch (e) {
        console.error("FX timeseries fetch failed", e);
      }
    }

    return Response.json({
      success: true,
      kpis: {
        totalInvested, // capital at work (pending + confirmed)
        realizedReturn: combinedReturn, // realized + accrued PnL for live feedback
        roi: nominalRoiPct, // ROI nominal
        realRoi: realRoiPct, // ROI adjusted for inflation over the window
        totalTrades: series.reduce((acc, _row) => acc, 0), // kept for compatibility; not used here
      },
      series,
      meta: {
        days: minDays,
        bucket,
        baseCurrency,
        compareCurrency,
        inflationPctForWindow,
      },
      fx,
    });
  } catch (error) {
    console.error("Error fetching performance:", error);
    return Response.json(
      { success: false, error: "Failed to fetch performance" },
      { status: 500 },
    );
  }
}
