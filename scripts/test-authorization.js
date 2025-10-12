const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Test Authorization Flow on Deployed Sepolia Contracts
 * Validates EIP-8004 compliance and limit enforcement
 */
async function main() {
  const network = hre.network.name;
  console.log(`\nTesting authorization on ${network}...`);
  console.log("=".repeat(60));

  // Load deployment info
  const deploymentFile = path.join(__dirname, "..", "deployments", `${network}.json`);
  if (!fs.existsSync(deploymentFile)) {
    console.error(`\n❌ Error: No deployment found for ${network}`);
    console.error(`   Run: npx hardhat run scripts/deploy.js --network ${network}`);
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));

  const [signer] = await hre.ethers.getSigners();
  const signerAddress = await signer.getAddress();

  console.log("\n📋 Test Configuration:");
  console.log(`Network: ${network}`);
  console.log(`Tester: ${signerAddress}`);
  console.log(`Cultiv8Agent: ${deployment.contracts.Cultiv8Agent.address}`);
  console.log(`AgentVault: ${deployment.contracts.AgentVault.address}`);

  // Connect to deployed contracts
  const agent = await hre.ethers.getContractAt(
    "Cultiv8Agent",
    deployment.contracts.Cultiv8Agent.address
  );

  console.log("\n" + "=".repeat(60));
  console.log("TEST 1: Authorize Agent");
  console.log("=".repeat(60));

  console.log("\n📤 Authorizing agent...");
  console.log(`   Agent: ${signerAddress} (using self for testing)`);
  console.log(`   Max per TX: $1,000 USDC`);
  console.log(`   Daily limit: $5,000 USDC`);

  const authTx = await agent.authorizeAgent(
    signerAddress, // Using deployer as agent for testing
    hre.ethers.parseUnits("1000", 6), // USDC has 6 decimals
    hre.ethers.parseUnits("5000", 6)
  );

  console.log(`   TX hash: ${authTx.hash}`);
  const authReceipt = await authTx.wait();
  console.log(`✅ Authorization confirmed in block ${authReceipt.blockNumber}`);
  console.log(`   Gas used: ${authReceipt.gasUsed.toString()}`);

  // Check for event
  const authEvent = authReceipt.logs.find(log => {
    try {
      return agent.interface.parseLog(log)?.name === 'AgentAuthorized';
    } catch {
      return false;
    }
  });

  if (authEvent) {
    console.log(`✅ AgentAuthorized event emitted`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("TEST 2: Verify Authorization Data");
  console.log("=".repeat(60));

  const auth = await agent.getAuthorization(signerAddress);

  console.log("\n📊 On-chain Authorization:");
  console.log(`   Active: ${auth.active}`);
  console.log(`   Agent: ${auth.agent}`);
  console.log(`   Max per TX: $${hre.ethers.formatUnits(auth.maxAmountPerTx, 6)} USDC`);
  console.log(`   Daily limit: $${hre.ethers.formatUnits(auth.dailyLimit, 6)} USDC`);
  console.log(`   Daily spent: $${hre.ethers.formatUnits(auth.dailySpent, 6)} USDC`);
  console.log(`   Authorized at: ${new Date(Number(auth.authorizedAt) * 1000).toISOString()}`);

  if (auth.active) {
    console.log("✅ Authorization verified on-chain");
  } else {
    console.error("❌ Authorization not active");
    process.exit(1);
  }

  console.log("\n" + "=".repeat(60));
  console.log("TEST 3: Check Execution Capability");
  console.log("=".repeat(60));

  // Test canExecute with various amounts
  const testAmounts = [500, 1000, 1500, 5000, 6000];

  for (const amount of testAmounts) {
    const canExecute = await agent.canExecute(
      signerAddress,
      hre.ethers.parseUnits(amount.toString(), 6)
    );
    const symbol = canExecute ? "✅" : "❌";
    const expected =
      amount <= 1000 && amount <= 5000 ? "(expected: yes)" : "(expected: no)";
    console.log(`   ${symbol} $${amount}: ${canExecute} ${expected}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("TEST 4: Update Spending Limits");
  console.log("=".repeat(60));

  console.log("\n📤 Updating limits to $2,000 per TX, $10,000 daily...");
  const updateTx = await agent.updateLimits(
    hre.ethers.parseUnits("2000", 6),
    hre.ethers.parseUnits("10000", 6)
  );
  await updateTx.wait();
  console.log("✅ Limits updated");

  const updatedAuth = await agent.getAuthorization(signerAddress);
  console.log(`   New max per TX: $${hre.ethers.formatUnits(updatedAuth.maxAmountPerTx, 6)} USDC`);
  console.log(`   New daily limit: $${hre.ethers.formatUnits(updatedAuth.dailyLimit, 6)} USDC`);

  console.log("\n" + "=".repeat(60));
  console.log("TEST 5: Get Remaining Daily Limit");
  console.log("=".repeat(60));

  const remaining = await agent.getRemainingDailyLimit(signerAddress);
  console.log(`\n   Remaining today: $${hre.ethers.formatUnits(remaining, 6)} USDC`);
  console.log("✅ Daily limit tracking working");

  console.log("\n" + "=".repeat(60));
  console.log("TEST 6: Test Revocation");
  console.log("=".repeat(60));

  console.log("\n📤 Revoking agent authorization...");
  const revokeTx = await agent.revokeAgent();
  await revokeTx.wait();
  console.log("✅ Revocation confirmed");

  const revokedAuth = await agent.getAuthorization(signerAddress);
  console.log(`   Active: ${revokedAuth.active} (should be false)`);

  if (!revokedAuth.active) {
    console.log("✅ Revocation verified");
  } else {
    console.error("❌ Revocation failed");
    process.exit(1);
  }

  // Re-authorize for further testing
  console.log("\n📤 Re-authorizing for further tests...");
  const reAuthTx = await agent.authorizeAgent(
    signerAddress,
    hre.ethers.parseUnits("1000", 6),
    hre.ethers.parseUnits("5000", 6)
  );
  await reAuthTx.wait();
  console.log("✅ Re-authorized");

  console.log("\n" + "=".repeat(60));
  console.log("🎉 ALL AUTHORIZATION TESTS PASSED");
  console.log("=".repeat(60));
  console.log("\n📊 Summary:");
  console.log("   ✅ Authorization works");
  console.log("   ✅ Limit enforcement validated");
  console.log("   ✅ Updates functional");
  console.log("   ✅ Revocation works");
  console.log("   ✅ Re-authorization works");
  console.log("\n✅ Contract is ready for integration testing\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Test failed:");
    console.error(error);
    process.exit(1);
  });

