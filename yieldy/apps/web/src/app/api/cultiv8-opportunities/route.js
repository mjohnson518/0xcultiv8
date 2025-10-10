import sql from "@/app/api/utils/sql";
import { rateLimitMiddleware } from "@/app/api/middleware/rateLimit";
import { validateRequest, validateQuery } from "@/app/api/middleware/validation";
import { OpportunityCreateSchema, OpportunityQuerySchema } from "@/app/api/schemas/opportunity";
import { cache, cacheKeys } from "@/app/api/utils/cache";

// Get all cultiv8 opportunities with filtering
export async function GET(request) {
  // Rate limiting - general tier for read operations
  const rateLimitError = await rateLimitMiddleware(request, 'general');
  if (rateLimitError) return rateLimitError;

  // Validate query parameters
  const queryValidationError = await validateQuery(OpportunityQuerySchema)(request);
  if (queryValidationError) return queryValidationError;

  try {
    const { searchParams } = new URL(request.url);
    const blockchain = searchParams.get('blockchain');
    const minApy = searchParams.get('minApy');
    const maxRisk = searchParams.get('maxRisk');
    const protocolType = searchParams.get('protocolType');
    const isActive = searchParams.get('isActive') !== 'false';

    let query = 'SELECT * FROM cultiv8_opportunities WHERE is_active = $1';
    let params = [isActive];
    let paramCount = 1;

    if (blockchain) {
      paramCount++;
      query += ` AND blockchain = $${paramCount}`;
      params.push(blockchain);
    }

    if (minApy) {
      paramCount++;
      query += ` AND apy >= $${paramCount}`;
      params.push(parseFloat(minApy));
    }

    if (maxRisk) {
      paramCount++;
      query += ` AND risk_score <= $${paramCount}`;
      params.push(parseInt(maxRisk));
    }

    if (protocolType) {
      paramCount++;
      query += ` AND protocol_type = $${paramCount}`;
      params.push(protocolType);
    }

    query += ' ORDER BY apy DESC, tvl DESC';

    // Try cache first
    const cacheKey = `${cacheKeys.opportunities(blockchain || 'all')}:${minApy || 0}:${maxRisk || 10}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return Response.json({ 
        success: true, 
        opportunities: cached,
        source: 'cache'
      });
    }

    const opportunities = await sql(query, params);
    
    // Cache the result
    await cache.set(cacheKey, opportunities, cache.TTL.opportunities);
    
    return Response.json({ 
      success: true, 
      opportunities: opportunities || [],
      source: 'database'
    });
  } catch (error) {
    console.error('Error fetching cultiv8 opportunities:', error);
    return Response.json({ 
      success: false, 
      error: 'Failed to fetch cultiv8 opportunities' 
    }, { status: 500 });
  }
}

// Create new cultiv8 opportunity
export async function POST(request) {
  // Rate limiting - config tier for creating opportunities
  const rateLimitError = await rateLimitMiddleware(request, 'config');
  if (rateLimitError) return rateLimitError;

  // Input validation
  const validationError = await validateRequest(OpportunityCreateSchema)(request);
  if (validationError) return validationError;

  try {
    // Use validated data (with defaults already applied by schema)
    const {
      protocol_name,
      blockchain,
      pool_address,
      token_symbol,
      apy,
      tvl,
      risk_score,
      protocol_type,
      minimum_deposit,
      lock_period,
      additional_info
    } = request.validated;

    const result = await sql`
      INSERT INTO cultiv8_opportunities (
        protocol_name, blockchain, pool_address, token_symbol, apy, tvl,
        risk_score, protocol_type, minimum_deposit, lock_period, additional_info
      ) VALUES (
        ${protocol_name}, ${blockchain}, ${pool_address}, ${token_symbol}, ${apy}, ${tvl},
        ${risk_score}, ${protocol_type}, ${minimum_deposit}, ${lock_period}, ${JSON.stringify(additional_info)}
      ) RETURNING *
    `;

    // Invalidate opportunities cache for this blockchain
    await cache.invalidatePattern(`opportunities:${blockchain}*`);

    return Response.json({
      success: true,
      opportunity: result[0]
    });
  } catch (error) {
    console.error('Error creating cultiv8 opportunity:', error);
    return Response.json({
      success: false,
      error: 'Failed to create cultiv8 opportunity'
    }, { status: 500 });
  }
}