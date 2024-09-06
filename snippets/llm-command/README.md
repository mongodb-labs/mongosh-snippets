# LLM Command Snippet

This snippet adds an `llm` command to mongosh that provides helpful suggestions or recommendations for MongoDB-related tasks. The query results are generated using Groq API by default, with an option to use other models via Ollama.

## Prerequisites

```
export GROQ_API_KEY=gsk_XXXXXXX
mongosh
```

## Usage

After installing the snippet, you can use the `llm` command in your MongoDB shell like this:

```javascript
llm("very briefly, just the command, do not use markdown: in mongosh how to get the collections names of current db?");
```

This will output a possible solution to your query, such as `db.getCollectionNames()`.

```javascript
llm("very briefly, just the command, do not use markdown: in mongosh replace all documents of a collection with property {'set':'llm102'} with the new value {'set':'llm101'} in current db?")
```

This will output a possible solution to your query, such as `db.collection.updateMany({ set: 'llm102' }, { $set: { set: 'llm101' } })`.

You can also specify a different model to use with an optional parameter:
```javascript 
llm("Your query here", { model: "phi3.5" });
```
This will use the specified model (in this case, 'phi3.5') via Ollama instead of the default Groq API.

## Models

By default, the `llm` command uses the Groq API with the 'llama-3.1-70b-versatile' model. You can use other models by specifying them in the optional parameter:

- Groq API (default): No need to specify, just use `llm("Your query")`.
- Ollama models: Specify the model name, e.g., `llm("Your query", { model: "gemini2" })` or `llm("Your query", { model: "phi3.5" })`.

Note: When using Ollama models, make sure you have Ollama running locally on the default port (11434).


## Installation

You can install this snippet using the `snippet` command in mongosh:

```javascript
snippet install llm-command
```

## Troubleshooting

If you get the error:
```
"Error: Cannot find module 'groq-sdk'"
```
then, go to your $USER/.mongodb/mongosh/snippets/node_modules/@juananpe/snippets-llm-command folder
and run `npm install`. Then close and open mongosh again.


## License

This snippet is licensed under the Apache-2.0 license.
