(() => {
  const localRequire = require("module").createRequire(__filename);
  const fetch = localRequire("node-fetch-commonjs");
  const Groq = require('groq-sdk');

  const groqApiKey = process.env['GROQ_API_KEY'];

  globalThis.llm = async function (message, options = {}) {
    const model = options.model || 'groq'; // Default to Groq if no model specified

    try {
      if (model.toLowerCase() !== 'groq') {
        // Ollama version (for any non-Groq model)
        const response = await fetch("http://127.0.0.1:11434/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: model.toLowerCase(), // Use the specified model
            messages: [
              {
                role: "user",
                content: message,
              },
            ],
            stream: false,
          }),
        });

        const data = await response.json();

        if (data.message) {
          return data.message.content;
        } else {
          return "No message found in the response.";
        }
      } else {
        // Groq (llama) version
        if (!groqApiKey) {
          console.warn('Groq API key is not set. Please set the GROQ_API_KEY environment variable.');
          return 'Unable to fetch message due to missing Groq API key.';
        }

        const groq = new Groq({
          apiKey: groqApiKey,
        });

        const chatCompletion = await groq.chat.completions.create({
          messages: [{ role: 'user', content: message }],
          model: 'llama-3.1-70b-versatile',
        });

        if (chatCompletion.choices && chatCompletion.choices.length > 0) {
          return chatCompletion.choices[0].message.content;
        } else {
          return "No message found in the response.";
        }
      }
    } catch (error) {
      console.error("Error fetching message:", error);
      return "An error occurred while fetching the message.";
    }
  };
})();
