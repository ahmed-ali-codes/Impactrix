# IMPAKTRIX: Code Impact Intelligence Platform

See the impact before the change. IMPAKTRIX is a universal code impact analysis tool built as both a **VS Code Extension** and a **Model Context Protocol (MCP) Server**. It uses local dependency graph analysis combined with AI-powered reasoning to show you the "blast radius" of any code change.

## Features

- **VS Code Extension**: Real-time detection of code changes in VS Code, with visual gutter icons and an interactive Impact Panel.
- **MCP Server Integration**: Exposes the `analyze_impact` tool for AI agents (like Antigravity or Claude Desktop) to proactively assess the impact of their code changes.
- **AI-Powered Insights**: Uses Google's Gemini to explain the severity and implications of code changes and suggest test cases.
- **Universal Adapters**: Designed to support multiple languages (TypeScript, Python, etc.) via a pluggable adapter system.

## Getting Started

### Prerequisites
- Node.js (v18+)
- A Google GenAI API Key

### Setup
1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Set up your environment variables:
   ```bash
   cp .env.example .env
   ```
   Add your `API_KEY` to the `.env` file.

3. Compile the project:
   ```bash
   npm run compile
   ```
   This will build both the VS Code extension (`out/extension.js`), the React Webview (`out/webview/bundle.js`), and the MCP Server (`out/mcp.js`).

### Testing the VS Code Extension
1. Open this repository in VS Code.
2. Press **F5** to launch the Extension Development Host.
3. Open the **IMPAKTRIX** panel in the sidebar and start modifying code to see the impact.

### Testing the MCP Server
If you use an MCP-compatible IDE like Antigravity:
1. Open your MCP configuration settings.
2. Import or point to the `mcp_config.json` file located in the root of this repository.
3. Your AI agent will instantly gain the `analyze_impact` tool.
