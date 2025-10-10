import sql from "@/app/api/utils/sql";
import { rateLimitMiddleware } from "@/app/api/middleware/rateLimit";
import { validateRequest } from "@/app/api/middleware/validation";
import { AgentConfigUpdateSchema } from "@/app/api/schemas/config";

// Get agent configuration
export async function GET(request) {
  // Rate limiting - general tier
  const rateLimitError = await rateLimitMiddleware(request, 'general');
  if (rateLimitError) return rateLimitError;

  try {
    const config = await sql`
      SELECT * FROM agent_config ORDER BY id DESC LIMIT 1
    `;

    // NEW: create a default config if none exists
    if (!config || config.length === 0) {
      const inserted = await sql`
        INSERT INTO agent_config (
          max_investment_per_opportunity,
          max_total_investment,
          min_apy_threshold,
          max_risk_score,
          auto_invest_enabled,
          scan_interval_minutes,
          preferred_protocols,
          blacklisted_protocols
        ) VALUES (
          1000, 10000, 5.0, 7, false, 1440, NULL, NULL
        ) RETURNING *
      `;
      return Response.json({ success: true, config: inserted[0] });
    }

    return Response.json({
      success: true,
      config: config[0] || null,
    });
  } catch (error) {
    console.error("Error fetching agent config:", error);
    return Response.json(
      {
        success: false,
        error: "Failed to fetch agent configuration",
      },
      { status: 500 },
    );
  }
}

// Update agent configuration
export async function PUT(request) {
  // Rate limiting - config tier for configuration changes
  const rateLimitError = await rateLimitMiddleware(request, 'config');
  if (rateLimitError) return rateLimitError;

  // Input validation
  const validationError = await validateRequest(AgentConfigUpdateSchema)(request);
  if (validationError) return validationError;

  try {
    const body = request.validated;
    // Use validated data from middleware
    const {
      max_investment_per_opportunity,
      max_total_investment,
      min_apy_threshold,
      max_risk_score,
      auto_invest_enabled,
      scan_interval_minutes,
      preferred_protocols,
      blacklisted_protocols,
    } = body;

    // Ensure a config row exists; create default if not
    let currentConfig = await sql`
      SELECT * FROM agent_config ORDER BY id DESC LIMIT 1
    `;

    if (!currentConfig || currentConfig.length === 0) {
      await sql`
        INSERT INTO agent_config (
          max_investment_per_opportunity,
          max_total_investment,
          min_apy_threshold,
          max_risk_score,
          auto_invest_enabled,
          scan_interval_minutes,
          preferred_protocols,
          blacklisted_protocols
        ) VALUES (
          1000, 10000, 5.0, 7, false, 1440, NULL, NULL
        )
      `;
      currentConfig = await sql`
        SELECT * FROM agent_config ORDER BY id DESC LIMIT 1
      `;
    }

    const configId = currentConfig[0].id;

    // Build update query dynamically
    let updateFields = [];
    let params = [];
    let paramCount = 0;

    if (max_investment_per_opportunity !== undefined) {
      paramCount++;
      updateFields.push(`max_investment_per_opportunity = $${paramCount}`);
      params.push(max_investment_per_opportunity);
    }

    if (max_total_investment !== undefined) {
      paramCount++;
      updateFields.push(`max_total_investment = $${paramCount}`);
      params.push(max_total_investment);
    }

    if (min_apy_threshold !== undefined) {
      paramCount++;
      updateFields.push(`min_apy_threshold = $${paramCount}`);
      params.push(min_apy_threshold);
    }

    if (max_risk_score !== undefined) {
      paramCount++;
      updateFields.push(`max_risk_score = $${paramCount}`);
      params.push(max_risk_score);
    }

    if (auto_invest_enabled !== undefined) {
      paramCount++;
      updateFields.push(`auto_invest_enabled = $${paramCount}`);
      params.push(auto_invest_enabled);
    }

    if (scan_interval_minutes !== undefined) {
      paramCount++;
      updateFields.push(`scan_interval_minutes = $${paramCount}`);
      params.push(scan_interval_minutes);
    }

    if (preferred_protocols !== undefined) {
      paramCount++;
      updateFields.push(`preferred_protocols = $${paramCount}`);
      params.push(preferred_protocols);
    }

    if (blacklisted_protocols !== undefined) {
      paramCount++;
      updateFields.push(`blacklisted_protocols = $${paramCount}`);
      params.push(blacklisted_protocols);
    }

    if (updateFields.length === 0) {
      return Response.json(
        {
          success: false,
          error: "No fields to update",
        },
        { status: 400 },
      );
    }

    // Add updated_at field
    paramCount++;
    updateFields.push(`updated_at = $${paramCount}`);
    params.push(new Date().toISOString());

    // Add WHERE clause parameter
    paramCount++;
    params.push(configId);

    const query = `
      UPDATE agent_config 
      SET ${updateFields.join(", ")} 
      WHERE id = $${paramCount} 
      RETURNING *
    `;

    const result = await sql(query, params);

    return Response.json({
      success: true,
      config: result[0],
    });
  } catch (error) {
    console.error("Error updating agent config:", error);
    return Response.json(
      {
        success: false,
        error: "Failed to update agent configuration",
      },
      { status: 500 },
    );
  }
}
