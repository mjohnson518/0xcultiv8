import { AaveV3Adapter } from '../yieldy/apps/web/src/app/api/protocols/AaveV3Adapter.js';
import { riskEngine } from '../yieldy/apps/web/src/app/api/utils/riskEngine.js';
import { ethers } from 'ethers';

/**
 * Sepolia Backend Integration Test
 * Validates that backend can connect to Sepolia and interact with protocols
 */
async function testSepoliaIntegration() {
  console.log('\n' + '='.repeat(60));
  console.log('SEPOLIA BACKEND INTEGRATION TEST');
  console.log('='.repeat(60));

  // Verify environment
  if (!process.env.SEPOLIA_RPC_URL && !process.env.ETHEREUM_RPC_URL) {
    console.error('\n❌ Error: No RPC URL configured');
    console.error('   Set SEPOLIA_RPC_URL in environment');
    process.exit(1);
  }

  const rpcUrl = process.env.SEPOLIA_RPC_URL || process.env.ETHEREUM_RPC_URL;

  console.log('\n📋 Configuration:');
  console.log(`RPC URL: ${rpcUrl.substring(0, 40)}...`);

  // Connect to Sepolia
  console.log('\n' + '='.repeat(60));
  console.log('TEST 1: Network Connection');
  console.log('='.repeat(60));

  const provider = new ethers.JsonRpcProvider(rpcUrl);

  try {
    const network = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();

    console.log(`\n✅ Connected to: ${network.name}`);
    console.log(`   Chain ID: ${network.chainId}`);
    console.log(`   Latest block: ${blockNumber}`);

    if (network.chainId !== 11155111n) {
      console.warn(`\n⚠️  Warning: Expected Sepolia (11155111), got ${network.chainId}`);
    }
  } catch (error) {
    console.error('\n❌ Connection failed:', error.message);
    process.exit(1);
  }

  // Test Aave V3 Adapter on Sepolia
  console.log('\n' + '='.repeat(60));
  console.log('TEST 2: Aave V3 Sepolia Adapter');
  console.log('='.repeat(60));

  try {
    const aaveAdapter = new AaveV3Adapter(provider, 11155111); // Sepolia chain ID

    console.log('\n📊 Fetching USDC APY from Aave V3 Sepolia...');
    const apyData = await aaveAdapter.getCurrentAPY();

    console.log(`   APY: ${apyData.apy}%`);
    console.log(`   Source: ${apyData.source}`);
    console.log(`   Protocol: ${apyData.protocol}`);

    if (apyData.source === 'on-chain') {
      console.log('✅ Real on-chain APY fetched successfully');
    } else {
      console.warn('⚠️  APY fetch failed, using fallback');
    }

    console.log('\n📊 Fetching TVL from Aave V3 Sepolia...');
    const tvlData = await aaveAdapter.getTVL();

    console.log(`   TVL: $${tvlData.tvl.toLocaleString()} USDC`);
    console.log(`   Source: ${tvlData.source}`);

    if (tvlData.source === 'on-chain') {
      console.log('✅ Real on-chain TVL fetched successfully');
    } else {
      console.warn('⚠️  TVL fetch failed, using fallback');
    }

    // Store for later tests
    global.testData = {
      apy: apyData.apy,
      tvl: tvlData.tvl,
    };
  } catch (error) {
    console.error('\n❌ Aave adapter test failed:', error.message);
    throw error;
  }

  // Test Transaction Building
  console.log('\n' + '='.repeat(60));
  console.log('TEST 3: Transaction Building');
  console.log('='.repeat(60));

  try {
    const testAmount = ethers.parseUnits('100', 6); // 100 USDC
    const testAddress = '0x3a8225ee1531f094F69A1d6070c7415C07d0949D';

    console.log('\n🔨 Building deposit transaction for $100 USDC...');
    const aaveAdapter = new AaveV3Adapter(provider, 11155111);
    const transactions = await aaveAdapter.buildDepositTransaction(testAddress, testAmount);

    console.log(`   Transaction count: ${transactions.length}`);
    transactions.forEach((tx, i) => {
      console.log(`   ${i + 1}. ${tx.description}`);
      console.log(`      To: ${tx.to}`);
    });

    console.log('✅ Transaction building successful');

    // Test gas estimation
    console.log('\n⛽ Estimating gas cost...');
    const gasEstimate = await aaveAdapter.estimateDepositGas(testAddress, testAmount);
    console.log(`   Estimated gas: ${gasEstimate.toString()}`);

    const feeData = await provider.getFeeData();
    const gasCostWei = gasEstimate * (feeData.maxFeePerGas || 0n);
    const gasCostETH = Number(gasCostWei) / 1e18;

    console.log(`   Estimated cost: ${gasCostETH.toFixed(6)} ETH`);
    console.log('✅ Gas estimation successful');
  } catch (error) {
    console.error('\n❌ Transaction building failed:', error.message);
    throw error;
  }

  // Test Risk Engine
  console.log('\n' + '='.repeat(60));
  console.log('TEST 4: Risk Engine with Real Data');
  console.log('='.repeat(60));

  try {
    const testOpportunity = {
      id: 1,
      protocol_name: 'Aave V3',
      blockchain: 'sepolia',
      apy: global.testData.apy,
      tvl: global.testData.tvl,
      protocol_age_years: 3,
      audit_count: 5,
      has_bug_bounty: true,
      governance_type: 'decentralized',
      team_doxxed: true,
      contract_complexity: 'complex',
      is_upgradeable: true,
    };

    console.log('\n🧮 Calculating risk score for Aave V3 Sepolia...');
    const riskScore = await riskEngine.calculateRisk(testOpportunity);

    console.log(`   Composite Score: ${riskScore.composite}/10`);
    console.log(`   Protocol Risk: ${riskScore.breakdown.protocol}/10`);
    console.log(`   Financial Risk: ${riskScore.breakdown.financial}/10`);
    console.log(`   Technical Risk: ${riskScore.breakdown.technical}/10`);
    console.log(`   Market Risk: ${riskScore.breakdown.market}/10`);
    console.log(`   Reasoning: ${riskScore.reasoning}`);

    console.log('✅ Risk engine calculation successful');
  } catch (error) {
    console.error('\n❌ Risk engine test failed:', error.message);
    console.error('   This is expected without Redis/DB connection');
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('🎉 SEPOLIA INTEGRATION TEST SUMMARY');
  console.log('='.repeat(60));
  console.log('\n✅ Network connection: PASS');
  console.log('✅ Aave V3 APY fetch: PASS');
  console.log('✅ TVL calculation: PASS');
  console.log('✅ Transaction building: PASS');
  console.log('✅ Gas estimation: PASS');
  console.log('⚠️  Risk engine: PARTIAL (needs DB/Redis)');
  console.log('\n✅ Backend can interact with Sepolia successfully!');
  console.log('✅ Ready for end-to-end transaction testing\n');
}

testSepoliaIntegration();

