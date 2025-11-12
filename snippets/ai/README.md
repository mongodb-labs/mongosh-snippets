# AI Snippets for mongosh

> [!CAUTION]
> This is an experimental, early-stage snippet that is not meant for production use. 

This snippet adds a suite of commands accessible with the `ai` command. This includes:

|  |  |  |
|---------|-------------|---------|
| `ai.ask` | Ask questions about MongoDB | `ai.ask how do I run queries in mongosh?` |
| `ai.cmd` | Generate general mongosh commands _alias:_ `ai.cmd` | `ai.cmd get sharding info` |
| `ai.find` | Generate queries and aggregations based on natural language | `ai.find users with age > 30` |
| `ai.collection` | Set the active collection | `ai.collection users` |
| `ai.config` | Configure the AI commands | `ai.config.set("provider", "ollama")` |

This currently supports 5 different AI providers: `docs, openai | mistral | atlas | ollama` and any model they support. For cloud providers, you can specify the API key with `MONGOSH_AI_API_KEY`.

## Installation

You can install this snippet using the `snippet` command in mongosh:

```javascript
config.set('snippetIndexSourceURLs', config.get('snippetIndexSourceURLs') +
'; https://github.com/gagik/mongosh-snippets/raw/refs/heads/ai/index.bson.br'
 )
snippet install ai
```

## License

This snippet is licensed under the Apache-2.0 license.
