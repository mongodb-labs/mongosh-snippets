# AI Snippets for mongosh

> [!CAUTION]
> This is an experimental, early-stage snippet that is not meant for production use. 

This snippet adds a suite of commands accessible with the `ai` command. This includes:

|  |  |  |
|---------|-------------|---------|
| `ai.ask` | Ask questions about MongoDB | `ai.ask how do I run queries in mongosh?` |
| `ai.data` | Generate data-related mongosh commands | `ai.data insert some sample user info` |
| `ai.query` | Generate a MongoDB query or aggregation | `ai.query find documents where name = "Ada"` |
| `ai.collection` | Set the active collection | `ai.collection users` |
| `ai.command` | Generate general mongosh commands _alias:_ `ai.cmd` | `ai.command get sharding info` |
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
