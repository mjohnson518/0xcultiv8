import { ethers } from 'ethers';

/**
 * Simple Sepolia Integration Test
 * Tests protocol adapter connectivity without backend dependencies
 */

// Aave V3 Pool ABI (minimal)
const AAVE_POOL_ABI = [
  'function getReserveData(address asset) view returns (tuple(uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt))',
];

const ERC20_ABI = [
  'function totalSupply() view returns (uint256)',
  'function decimals() view returns (uint8)',
];

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('SEPOLIA PROTOCOL INTEGRATION TEST');
  console.log('='.repeat(60));

  const rpcUrl = process.env.SEPOLIA_RPC_URL || process.env.ETHEREUM_RPC_URL;

  if (!rpcUrl) {
    console.error('\n❌ Error: No RPC URL');
    console.error('   Set SEPOLIA_RPC_URL environment variable');
    process.exit(1);
  }

  console.log(`\nRPC: ${rpcUrl.substring(0, 40)}...`);

  // Connect
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const network = await provider.getNetwork();
  const blockNumber = await provider.getBlockNumber();

  console.log(`\n✅ Connected to ${network.name}`);
  console.log(`   Chain ID: ${network.chainId}`);
  console.log(`   Block: ${blockNumber}`);

  // Aave V3 Sepolia addresses
  const AAVE_POOL = '0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951';
  const USDC_SEPOLIA = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';

  console.log('\n' + '='.repeat(60));
  console.log('TEST: Aave V3 Sepolia - Fetch APY');
  console.log('='.repeat(60));

  try {
    const pool = new ethers.Contract(AAVE_POOL, AAVE_POOL_ABI, provider);

    console.log('\nFetching USDC reserve data from Aave...');
    const reserveData = await pool.getReserveData(USDC_SEPOLIA);

    const supplyRateRay = reserveData.currentLiquidityRate;
    const supplyAPR = Number(supplyRateRay) / 1e27;
    const supplyAPY = supplyAPR * 100;

    console.log(`✅ USDC Supply APY: ${supplyAPY.toFixed(4)}%`);
    console.log(`   Liquidity Rate (ray): ${supplyRateRay.toString()}`);
    console.log(`   APR: ${(supplyAPR * 100).toFixed(4)}%`);

    // Get aToken address and TVL
    const aTokenAddress = reserveData.aTokenAddress;
    console.log(`   aToken: ${aTokenAddress}`);

    const aToken = new ethers.Contract(aTokenAddress, ERC20_ABI, provider);
    const totalSupply = await aToken.totalSupply();
    const decimals = await aToken.decimals();
    const tvl = Number(totalSupply) / Math.pow(10, Number(decimals));

    console.log(`\n✅ Aave USDC TVL: $${tvl.toLocaleString()}`);
    console.log(`   Total Supply: ${totalSupply.toString()}`);
    console.log(`   Decimals: ${decimals}`);

    console.log('\n' + '='.repeat(60));
    console.log('🎉 ALL TESTS PASSED');
    console.log('='.repeat(60));
    console.log('\n📊 Results:');
    console.log(`   APY: ${supplyAPY.toFixed(4)}%`);
    console.log(`   TVL: $${tvl.toLocaleString()}`);
    console.log(`   Network: Sepolia (${network.chainId})`);
    console.log('\n✅ Backend can fetch real on-chain data from Sepolia');
    console.log('✅ Ready for full agent integration\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();

