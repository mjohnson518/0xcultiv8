import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getProtocolAdapter } from '../../protocols/adapters.js';
import { riskEngine } from '../../utils/riskEngine.js';
import sql from '../../utils/sql.js';

/**
 * DeFi Oracle MCP Server
 * Provides real-time DeFi protocol data as tools for the AI agent
 */
class DeFiOracleServer {
  constructor() {
    this.server = new Server(
      {
        name: "cultiv8-defi-oracle",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupTools();
    this.setupErrorHandling();
  }

  setupTools() {
    // List available tools
    this.server.setRequestHandler("tools/list", async () => {
      return {
        tools: [
          {
            name: "get_apy",
            description: "Get current APY for a DeFi protocol",
            inputSchema: {
              type: "object",
              properties: {
                protocol: {
                  type: "string",
                  enum: ["aave", "compound"],
                  description: "Protocol name",
                },
                chain: {
                  type: "string",
                  enum: ["ethereum", "base"],
                  description: "Blockchain network",
                },
              },
              required: ["protocol", "chain"],
            },
          },
          {
            name: "get_tvl",
            description: "Get Total Value Locked for a protocol",
            inputSchema: {
              type: "object",
              properties: {
                protocol: { type: "string", enum: ["aave", "compound"] },
                chain: { type: "string", enum: ["ethereum", "base"] },
              },
              required: ["protocol", "chain"],
            },
          },
          {
            name: "get_risk_score",
            description: "Calculate multi-dimensional risk score for an opportunity",
            inputSchema: {
              type: "object",
              properties: {
                protocol: { type: "string" },
                chain: { type: "string" },
              },
              required: ["protocol", "chain"],
            },
          },
          {
            name: "compare_protocols",
            description: "Compare multiple protocols side-by-side",
            inputSchema: {
              type: "object",
              properties: {
                protocols: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      protocol: { type: "string" },
                      chain: { type: "string" },
                    },
                  },
                },
              },
              required: ["protocols"],
            },
          },
        ],
      };
    });

    // Tool call handler
    this.server.setRequestHandler("tools/call", async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "get_apy": {
            const adapter = getProtocolAdapter(args.protocol, args.chain);
            const result = await adapter.getCurrentAPY();

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case "get_tvl": {
            const adapter = getProtocolAdapter(args.protocol, args.chain);
            const result = await adapter.getTVL();

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case "get_risk_score": {
            // Get opportunity from database
            const opportunity = await sql`
              SELECT * FROM cultiv8_opportunities
              WHERE protocol_name ILIKE ${args.protocol}
              AND blockchain = ${args.chain}
              LIMIT 1
            `;

            if (!opportunity || opportunity.length === 0) {
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({ error: "Opportunity not found" }),
                  },
                ],
              };
            }

            const score = await riskEngine.calculateRisk(opportunity[0]);

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(score, null, 2),
                },
              ],
            };
          }

          case "compare_protocols": {
            const comparisons = await Promise.all(
              args.protocols.map(async ({ protocol, chain }) => {
                const adapter = getProtocolAdapter(protocol, chain);
                const [apy, tvl] = await Promise.all([
                  adapter.getCurrentAPY(),
                  adapter.getTVL(),
                ]);

                return {
                  protocol,
                  chain,
                  apy: apy.apy,
                  tvl: tvl.tvl,
                };
              })
            );

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(comparisons, null, 2),
                },
              ],
            };
          }

          default:
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ error: `Unknown tool: ${name}` }),
                },
              ],
              isError: true,
            };
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

  setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error("[MCP Error]", error);
    };

    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log("DeFi Oracle MCP Server running");
  }
}

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new DeFiOracleServer();
  server.run().catch(console.error);
}

export default DeFiOracleServer;

