require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
      forking: {
        url: process.env.ETHEREUM_RPC_URL || "",
        enabled: false,
      },
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || process.env.ETHEREUM_RPC_URL || "",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 11155111,
      gasPrice: "auto",
      verify: {
        etherscan: {
          apiKey: process.env.ETHERSCAN_API_KEY || "",
        },
      },
    },
    baseSepolia: {
      url: process.env.BASE_RPC_URL || "",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 84532,
    },
    mainnet: {
      url: process.env.ETHEREUM_RPC_URL || "",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 1,
    },
    base: {
      url: process.env.BASE_RPC_URL || "",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 8453,
    },
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY || "",
      sepolia: process.env.ETHERSCAN_API_KEY || "",
      base: process.env.BASESCAN_API_KEY || "",
      baseSepolia: process.env.BASESCAN_API_KEY || "",
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./contracts/test",
    cache: "./contracts/cache",
    artifacts: "./contracts/artifacts",
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
  },
};

