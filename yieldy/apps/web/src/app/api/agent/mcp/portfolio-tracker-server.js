import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import sql from '../../utils/sql.js';
import { portfolioOptimizer } from '../../utils/portfolioOptimizer.js';

/**
 * Portfolio Tracker MCP Server  
 * Provides portfolio analysis and rebalancing recommendations
 */
class PortfolioTrackerServer {
  constructor() {
    this.server = new Server(
      {
        name: "cultiv8-portfolio-tracker",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupTools();
  }

  setupTools() {
    this.server.setRequestHandler("tools/list", async () => {
      return {
        tools: [
          {
            name: "get_positions",
            description: "Get user's current investment positions",
            inputSchema: {
              type: "object",
              properties: {
                userAddress: { type: "string", description: "User address" },
              },
              required: ["userAddress"],
            },
          },
          {
            name: "calculate_performance",
            description: "Calculate portfolio performance metrics",
            inputSchema: {
              type: "object",
              properties: {
                userAddress: { type: "string" },
                days: { type: "number", default: 30 },
              },
              required: ["userAddress"],
            },
          },
          {
            name: "check_rebalance_needed",
            description: "Check if portfolio needs rebalancing",
            inputSchema: {
              type: "object",
              properties: {
                userAddress: { type: "string" },
                threshold: { type: "number", default: 5, description: "Drift threshold %" },
              },
              required: ["userAddress"],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler("tools/call", async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "get_positions": {
            const positions = await sql`
              SELECT i.*, o.protocol_name, o.apy as current_apy, o.blockchain
              FROM investments i
              LEFT JOIN cultiv8_opportunities o ON i.opportunity_id = o.id
              WHERE i.status IN ('pending', 'confirmed')
              ORDER BY i.invested_at DESC
            `;

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    positions: positions || [],
                    count: positions?.length || 0,
                    totalInvested: positions?.reduce((sum, p) => sum + Number(p.amount), 0) || 0,
                  }, null, 2),
                },
              ],
            };
          }

          case "calculate_performance": {
            const { userAddress, days } = args;

            const investments = await sql`
              SELECT * FROM investments
              WHERE invested_at > NOW() - INTERVAL '${days} days'
              ORDER BY invested_at DESC
            `;

            const totalInvested = investments?.reduce((sum, i) => sum + Number(i.amount), 0) || 0;
            const totalReturn = investments?.reduce((sum, i) => sum + Number(i.actual_return || 0), 0) || 0;
            const returnPercentage = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    period: `${days} days`,
                    totalInvested,
                    totalReturn,
                    returnPercentage: returnPercentage.toFixed(2),
                    investmentCount: investments?.length || 0,
                  }, null, 2),
                },
              ],
            };
          }

          case "check_rebalance_needed": {
            const { userAddress, threshold } = args;

            // Get current positions
            const currentPositions = await sql`
              SELECT * FROM investments
              WHERE status IN ('pending', 'confirmed')
            `;

            // Get optimal allocation
            const opportunities = await sql`
              SELECT * FROM cultiv8_opportunities
              WHERE is_active = true
              ORDER BY apy DESC
            `;

            const config = await sql`
              SELECT * FROM agent_config ORDER BY id DESC LIMIT 1
            `;

            if (!config || config.length === 0) {
              throw new Error('Agent config not found');
            }

            const totalFunds = currentPositions?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

            const optimalPlan = portfolioOptimizer.optimizeAllocation(
              opportunities || [],
              {
                maxTotalInvestment: totalFunds,
                maxRiskScore: config[0].max_risk_score,
                maxInvestmentPerOpportunity: config[0].max_investment_per_opportunity,
              }
            );

            const rebalanceCheck = portfolioOptimizer.needsRebalancing(
              currentPositions || [],
              optimalPlan.allocations,
              threshold || 5
            );

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(rebalanceCheck, null, 2),
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
    console.log("Portfolio Tracker MCP Server running");
  }
}

export default PortfolioTrackerServer;

