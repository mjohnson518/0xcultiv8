import sql from "@/app/api/utils/sql";

// Get all cultiv8 opportunities with filtering
export async function GET(request) {
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

    const opportunities = await sql(query, params);
    
    return Response.json({ 
      success: true, 
      opportunities: opportunities || [] 
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
  try {
    const body = await request.json();
    const {
      protocol_name,
      blockchain,
      pool_address,
      token_symbol = 'USDC',
      apy,
      tvl,
      risk_score = 5,
      protocol_type,
      minimum_deposit = 0,
      lock_period = 0,
      additional_info = {}
    } = body;

    if (!protocol_name || !blockchain || !pool_address || !apy) {
      return Response.json({
        success: false,
        error: 'Missing required fields: protocol_name, blockchain, pool_address, apy'
      }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO cultiv8_opportunities (
        protocol_name, blockchain, pool_address, token_symbol, apy, tvl,
        risk_score, protocol_type, minimum_deposit, lock_period, additional_info
      ) VALUES (
        ${protocol_name}, ${blockchain}, ${pool_address}, ${token_symbol}, ${apy}, ${tvl},
        ${risk_score}, ${protocol_type}, ${minimum_deposit}, ${lock_period}, ${JSON.stringify(additional_info)}
      ) RETURNING *
    `;

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