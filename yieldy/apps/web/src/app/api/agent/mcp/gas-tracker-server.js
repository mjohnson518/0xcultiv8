import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ethers } from 'ethers';
import { GasOptimizer } from '../../utils/gasOptimizer.js';

/**
 * Gas Tracker MCP Server
 * Provides gas price data and optimization tools for the AI agent
 */
class GasTrackerServer {
  constructor() {
    this.server = new Server(
      {
        name: "cultiv8-gas-tracker",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize providers
    this.providers = {
      ethereum: new ethers.JsonRpcProvider(process.env.ETHEREUM_RPC_URL),
      base: new ethers.JsonRpcProvider(process.env.BASE_RPC_URL),
    };

    this.setupTools();
  }

  setupTools() {
    this.server.setRequestHandler("tools/list", async () => {
      return {
        tools: [
          {
            name: "estimate_gas",
            description: "Estimate gas cost for a transaction",
            inputSchema: {
              type: "object",
              properties: {
                chain: { type: "string", enum: ["ethereum", "base"] },
                to: { type: "string", description: "Target address" },
                data: { type: "string", description: "Transaction calldata" },
                value: { type: "string", default: "0" },
              },
              required: ["chain", "to"],
            },
          },
          {
            name: "get_gas_price",
            description: "Get optimal gas price for transaction priority",
            inputSchema: {
              type: "object",
              properties: {
                chain: { type: "string", enum: ["ethereum", "base"] },
                priority: {
                  type: "string",
                  enum: ["low", "medium", "high"],
                  default: "medium",
                },
              },
              required: ["chain"],
            },
          },
          {
            name: "predict_congestion",
            description: "Predict network congestion and recommend timing",
            inputSchema: {
              type: "object",
              properties: {
                chain: { type: "string", enum: ["ethereum", "base"] },
              },
              required: ["chain"],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler("tools/call", async (request) => {
      const { name, arguments: args } = request.params;

      try {
        const provider = this.providers[args.chain];
        if (!provider) {
          throw new Error(`Invalid chain: ${args.chain}`);
        }

        const gasOptimizer = new GasOptimizer(provider);

        switch (name) {
          case "estimate_gas": {
            const estimate = await provider.estimateGas({
              to: args.to,
              data: args.data || '0x',
              value: args.value || 0,
            });

            const feeData = await provider.getFeeData();
            const gasCostWei = estimate * (feeData.maxFeePerGas || 0n);
            const gasCostETH = Number(gasCostWei) / 1e18;
            const gasCostUSD = gasCostETH * 3000; // Rough ETH price

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    gasEstimate: estimate.toString(),
                    gasCostETH: gasCostETH.toFixed(6),
                    gasCostUSD: gasCostUSD.toFixed(2),
                  }, null, 2),
                },
              ],
            };
          }

          case "get_gas_price": {
            const gasPrices = await gasOptimizer.getOptimalGasPrice(
              args.priority || 'medium'
            );

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(gasPrices, null, 2),
                },
              ],
            };
          }

          case "predict_congestion": {
            const feeData = await provider.getFeeData();
            const baseFee = feeData.gasPrice || 0n;

            // Simple congestion heuristic based on base fee
            const baseFeeGwei = Number(baseFee) / 1e9;
            let congestion;

            if (baseFeeGwei < 20) {
              congestion = { level: 'low', recommendation: 'Good time to transact' };
            } else if (baseFeeGwei < 50) {
              congestion = { level: 'medium', recommendation: 'Moderate gas prices' };
            } else {
              congestion = { level: 'high', recommendation: 'Consider waiting for lower gas' };
            }

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    baseFeeGwei,
                    congestion,
                  }, null, 2),
                },
              ],
            };
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: error.message }),
            },
          ],
          isError: true,
        };
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log("Gas Tracker MCP Server running");
  }
}

export default GasTrackerServer;

