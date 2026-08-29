#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { ImpactEngine } from "../extension/core/ImpactEngine";
import { ImpactExplainer } from "../extension/ai/ImpactExplainer";
import * as fs from 'fs';

const workspaceRoot = process.argv[2] || process.cwd();
const engine = new ImpactEngine(workspaceRoot);
const explainer = new ImpactExplainer(workspaceRoot);

const server = new Server(
  {
    name: "impaktrix-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "analyze_impact",
        description: "Analyze the impact of modifying a specific line of code in a file. It returns the impacted files, dependency graph context, and an AI-generated risk assessment.",
        inputSchema: {
          type: "object",
          properties: {
            filePath: {
              type: "string",
              description: "The absolute path to the file being modified.",
            },
            lineNumber: {
              type: "number",
              description: "The 1-indexed line number where the change occurs.",
            },
          },
          required: ["filePath", "lineNumber"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "analyze_impact") {
    const filePath = String(request.params.arguments?.filePath);
    const lineNumber = Number(request.params.arguments?.lineNumber);

    if (!filePath || isNaN(lineNumber)) {
      throw new Error("Invalid arguments: filePath (string) and lineNumber (number) are required.");
    }

    try {
      if (!fs.existsSync(filePath)) {
          return {
              content: [{ type: "text", text: `Error: File not found at path \${filePath}` }],
              isError: true,
          };
      }
      
      const analysis = engine.analyze(filePath, lineNumber);
      if (!analysis) {
        return {
          content: [{ type: "text", text: "No impact detected for this line or file type not supported." }],
        };
      }

      const aiInsights = await explainer.explain(analysis);
      const fullResult = { ...analysis, ...aiInsights };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(fullResult, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: `Error analyzing impact: \${error.message}` }],
        isError: true,
      };
    }
  }

  throw new Error(`Tool not found: \${request.params.name}`);
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("IMPAKTRIX MCP Server running on stdio");
}

run().catch(console.error);
