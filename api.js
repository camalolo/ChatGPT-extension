export const providerConfigs = {
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    errorPrefix: 'OpenAI API error:'
  },
  openrouter: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    errorPrefix: 'OpenRouter API error:'
  }
};

export async function getSettings() {
  return await chrome.storage.sync.get([
    'sidepanelProvider',
    'openaiApiKey',
    'sidepanelModel',
    'sidepanelOpenrouterApiKey',
    'sidepanelOpenrouterModel'
  ]);
}

export async function callChatAPI(provider, apiKey, model, prompt) {
  let config;
  if (provider === 'openai') {
    config = providerConfigs.openai;
  } else if (provider === 'openrouter') {
    config = providerConfigs.openrouter;
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }
  const response = await fetch(config.url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${config.errorPrefix} ${response.status} ${errorText}`);
  }
  const data = await response.json();
  return data.choices[0].message.content.trim();
}