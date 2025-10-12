const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

/**
 * Deployment Script for Cultiv8 Smart Contracts
 * Deploys to specified network (Sepolia, Base Sepolia, or Mainnet)
 */
async function main() {
  const network = hre.network.name;
  console.log(`\nDeploying Cultiv8 contracts to ${network}...`);
  console.log("=".repeat(50));

  const [deployer] = await hre.ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const balance = await hre.ethers.provider.getBalance(deployerAddress);

  console.log("\n📋 Deployment Configuration:");
  console.log(`Network: ${network}`);
  console.log(`Deployer: ${deployerAddress}`);
  console.log(`Balance: ${hre.ethers.formatEther(balance)} ETH`);

  // Verify sufficient balance
  if (balance < hre.ethers.parseEther("0.01")) {
    console.error("\n❌ Error: Insufficient balance for deployment");
    console.error(`   Need at least 0.01 ETH, have ${hre.ethers.formatEther(balance)} ETH`);
    console.error(`   Get testnet ETH from: https://sepoliafaucet.com`);
    process.exit(1);
  }

  // Get USDC address for the network (checksummed)
  const usdcAddresses = {
    sepolia: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // Sepolia USDC (Circle)
    baseSepolia: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base Sepolia USDC
    mainnet: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  };

  const usdcAddress = usdcAddresses[network];
  if (!usdcAddress) {
    console.error(`\n❌ Error: USDC address not configured for ${network}`);
    process.exit(1);
  }

  console.log(`USDC Address: ${usdcAddress}`);
  console.log("\n" + "=".repeat(50));

  // Deploy Cultiv8Agent
  console.log("\n🚀 Deploying Cultiv8Agent (EIP-8004)...");
  const Cultiv8Agent = await hre.ethers.getContractFactory("Cultiv8Agent");
  const agent = await Cultiv8Agent.deploy();
  await agent.waitForDeployment();
  const agentAddress = await agent.getAddress();

  console.log(`✅ Cultiv8Agent deployed to: ${agentAddress}`);

  // Deploy AgentVault
  console.log("\n🚀 Deploying AgentVault (EIP-7702)...");
  const AgentVault = await hre.ethers.getContractFactory("AgentVault");
  const vault = await AgentVault.deploy(usdcAddress, agentAddress);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();

  console.log(`✅ AgentVault deployed to: ${vaultAddress}`);

  // Initial configuration
  console.log("\n⚙️  Configuring contracts...");

  // Whitelist Aave and Compound protocols
  const protocolAddresses = {
    sepolia: {
      aave: "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951", // Aave V3 Pool Sepolia
      compound: "0x0000000000000000000000000000000000000000", // Not on Sepolia
    },
    mainnet: {
      aave: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
      compound: "0xc3d688B66703497DAA19211EEdff47f25384cdc3",
    },
  };

  const protocols = protocolAddresses[network] || protocolAddresses.sepolia;

  if (protocols.aave !== "0x0000000000000000000000000000000000000000") {
    const tx1 = await agent.setProtocolWhitelist(protocols.aave, true);
    await tx1.wait();
    console.log(`✅ Whitelisted Aave: ${protocols.aave}`);
  }

  if (protocols.compound !== "0x0000000000000000000000000000000000000000") {
    const tx2 = await agent.setProtocolWhitelist(protocols.compound, true);
    await tx2.wait();
    console.log(`✅ Whitelisted Compound: ${protocols.compound}`);
  }

  // Save deployment info
  const deploymentInfo = {
    network,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployerAddress,
    timestamp: new Date().toISOString(),
    contracts: {
      Cultiv8Agent: {
        address: agentAddress,
        tx: agent.deploymentTransaction()?.hash,
      },
      AgentVault: {
        address: vaultAddress,
        tx: vault.deploymentTransaction()?.hash,
      },
    },
    configuration: {
      usdc: usdcAddress,
      whitelistedProtocols: protocols,
    },
  };

  // Save to deployments directory
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentFile = path.join(deploymentsDir, `${network}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

  console.log(`\n💾 Deployment info saved to: deployments/${network}.json`);

  // Display summary
  console.log("\n" + "=".repeat(50));
  console.log("🎉 DEPLOYMENT COMPLETE");
  console.log("=".repeat(50));
  console.log("\n📝 Contract Addresses:");
  console.log(`   Cultiv8Agent: ${agentAddress}`);
  console.log(`   AgentVault:   ${vaultAddress}`);
  console.log(`\n🔗 Verify on Etherscan:`);
  const baseUrl =
    network === "sepolia"
      ? "https://sepolia.etherscan.io"
      : network === "baseSepolia"
      ? "https://sepolia.basescan.org"
      : "https://etherscan.io";
  console.log(`   ${baseUrl}/address/${agentAddress}`);
  console.log(`   ${baseUrl}/address/${vaultAddress}`);

  console.log("\n🔧 Next Steps:");
  console.log("   1. Verify contracts:");
  console.log(`      npx hardhat verify --network ${network} ${agentAddress}`);
  console.log(`      npx hardhat verify --network ${network} ${vaultAddress} ${usdcAddress} ${agentAddress}`);
  console.log("\n   2. Update .env with contract addresses:");
  console.log(`      CULTIV8_AGENT_ADDRESS=${agentAddress}`);
  console.log(`      AGENT_VAULT_ADDRESS=${vaultAddress}`);
  console.log("\n   3. Test authorization flow");
  console.log("\n✅ Deployment successful!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });

