# AI Snippets for mongosh

> [!CAUTION]
> This is an experimental snippet that is not meant for production use. 

This snippet adds a suite of commands accessible with the `ai` command. This includes:

|  |  |  |
|---------|-------------|---------|
| `ai <question>` | Ask questions about MongoDB | `ai.ask how do I run queries in mongosh?` |
| `ai.cmd` | Generate general mongosh commands _alias:_ `ai.cmd` | `ai.cmd get sharding info` |
| `ai.find` | Generate queries and aggregations based on natural language | `ai.find users with age > 30` |
| `ai.collection` | Set the active collection | `ai.collection users` |
| `ai.config` | Configure the AI commands | `ai.config.set("provider", "ollama")` |

This currently supports 4 different AI providers: `mongodb`, `openai` (requires `MONGOSH_AI_OPENAI_API_KEY` environment variable to be set), `mistral` (requires `MONGOSH_AI_MISTRAL_API_KEY`) and `ollama`.

## Installation

You can install this snippet using the `snippet` command in mongosh:

```javascript
snippet install ai
```

## License

This snippet is licensed under the Apache-2.0 license.
