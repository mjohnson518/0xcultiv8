// SIMPLIFIED SCAN ENDPOINT - Returns mock data for testing
// This bypasses all database, auth, and complex logic

export async function POST(request) {
  console.log('🔍 Scan endpoint called');
  
  try {
    // Get request body
    const body = await request.json().catch(() => ({}));
    const { blockchain = 'both' } = body;
    
    console.log('Scan params:', { blockchain });
    
    // Mock opportunities - NO DATABASE NEEDED
    const mockOpportunities = [
      {
        id: 1,
        protocol: 'Aave V3',
        blockchain: 'ethereum',
        apy: 8.5,
        tvl: 5000000000,
        risk_score: 3.2,
        token: 'USDC',
        description: 'Stable yield on Ethereum mainnet'
      },
      {
        id: 2,
        protocol: 'Compound V3',
        blockchain: 'ethereum',
        apy: 7.2,
        tvl: 3000000000,
        risk_score: 3.5,
        token: 'ETH',
        description: 'ETH lending on Compound'
      },
      {
        id: 3,
        protocol: 'Aave V3',
        blockchain: 'base',
        apy: 12.3,
        tvl: 500000000,
        risk_score: 4.1,
        token: 'USDC',
        description: 'High yield on Base L2'
      },
      {
        id: 4,
        protocol: 'Uniswap V3',
        blockchain: 'base',
        apy: 15.8,
        tvl: 200000000,
        risk_score: 5.5,
        token: 'WETH-USDC',
        description: 'Liquidity provision on Base'
      }
    ];
    
    // Filter by blockchain if specified
    let filteredOpps = mockOpportunities;
    if (blockchain !== 'both') {
      filteredOpps = mockOpportunities.filter(
        opp => opp.blockchain === blockchain
      );
    }
    
    console.log(`✅ Returning ${filteredOpps.length} opportunities`);
    
    // Return success response
    return Response.json({
      success: true,
      opportunities: filteredOpps,
      message: `Scan completed successfully - found ${filteredOpps.length} opportunities`,
      timestamp: new Date().toISOString(),
      scanParams: { blockchain }
    });
    
  } catch (error) {
    console.error('❌ Scan error:', error);
    
    return Response.json({
      success: false,
      error: error.message,
      details: error.stack,
      suggestion: 'Check server logs for details'
    }, { status: 500 });
  }
}
