# Project Agent Snippet

Integrates Pi coding agent with mongosh for programmatic agent usage using the Pi SDK.

## Installation

```bash
npm install
```

## Usage

```javascript
// Send a prompt to the Pi agent
projectAgent.prompt("What files are in the current directory?")

// Show help
projectAgent.help()
```

## Configuration

The snippet uses the `@earendil-works/pi-coding-agent` package (v0.74.0+) for programmatic agent integration with mongosh.

### SDK Integration

This snippet uses the Pi SDK's programmatic interface:

- `AuthStorage`: Manages authentication credentials
- `ModelRegistry`: Handles AI model configuration
- `SessionManager`: Manages agent sessions (using in-memory storage)
- `createAgentSession`: Creates a new agent session

The agent session provides read, write, edit, and bash tools by default.

### Example

```javascript
// Ask the agent about files
await agent.prompt("List all TypeScript files in src/")

// Request code changes  
await agent.prompt("Add error handling to the main function")

// Get information
await agent.prompt("What does this codebase do?")
```
