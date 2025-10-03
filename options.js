// Voice descriptions
const voiceDescriptions = {
    alloy: "A neutral voice suitable for general use",
    echo: "A deep and resonant voice",
    fable: "A soft and gentle voice",
    onyx: "A professional and authoritative voice",
    nova: "A warm and welcoming voice",
    shimmer: "A clear and bright voice"
  };

// Fetch available models from OpenAI API
async function fetchModels(apiKey) {
  const modelSelect = document.querySelector('#model');
  const modelStatus = document.querySelector('#modelStatus');

  if (!apiKey) {
    modelSelect.innerHTML = '<option value="">Enter API key first</option>';
    modelStatus.textContent = '';
    return false;
  }

  modelStatus.textContent = 'Loading models...';
  modelStatus.style.color = '#666';

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const models = data.data
      .filter(model => model.id.startsWith('gpt-'))
      .toSorted((a, b) => a.id.localeCompare(b.id));

    modelSelect.innerHTML = '<option value="">Select a model...</option>';
    for (const model of models) {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = model.id;
      modelSelect.append(option);
    }

    modelStatus.textContent = `Loaded ${models.length} models`;
    modelStatus.style.color = '#16a34a';
    return true;
  } catch (error) {
    console.error('Error fetching models:', error);
    modelSelect.innerHTML = '<option value="">Failed to load models</option>';
    modelStatus.textContent = 'Invalid API key or network error';
    modelStatus.style.color = '#dc2626';
    return false;
  }
}
  
  // Update voice description when selection changes
  document.querySelector('#voice').addEventListener('change', (event) => {
    const description = voiceDescriptions[event.target.value];
    document.querySelector('#voiceDescription').textContent = description;
  });
  
  // Saves options to chrome.storage
  async function saveOptions() {
    const apiKey = document.querySelector('#apiKey').value;
    const model = document.querySelector('#model').value;
    const voice = document.querySelector('#voice').value;
    const status = document.querySelector('#status');
  
    if (!apiKey) {
      status.textContent = 'Please enter an API key.';
      status.style.color = '#dc2626';
      setTimeout(() => {
        status.textContent = '';
        status.style.color = '';
      }, 3000);
      return;
    }
  
    if (!model) {
      status.textContent = 'Please select a model.';
      status.style.color = '#dc2626';
      setTimeout(() => {
        status.textContent = '';
        status.style.color = '';
      }, 3000);
      return;
    }
  
    // Validate API key and model by fetching models
    status.textContent = 'Validating...';
    const isValid = await fetchModels(apiKey);
    if (!isValid) {
      status.textContent = 'Validation failed. Check your API key.';
      status.style.color = '#dc2626';
      setTimeout(() => {
        status.textContent = '';
        status.style.color = '';
      }, 3000);
      return;
    }
  
    // Re-select the model after validation (since fetchModels clears the dropdown)
    document.querySelector('#model').value = model;
  
    chrome.storage.sync.set(
      {
        openaiApiKey: apiKey,
        selectedModel: model,
        selectedVoice: voice
      },
      () => {
        // Update status to let user know options were saved.
        status.textContent = 'Settings saved.';
        status.style.color = '#16a34a';
        setTimeout(() => {
          status.textContent = '';
          status.style.color = '';
        }, 2000);
      }
    );
  }
  
  // Restores select box and checkbox state using the preferences
  // stored in chrome.storage.
  async function restoreOptions() {
    chrome.storage.sync.get(
      {
        openaiApiKey: '', // default value
        selectedModel: '', // default value
        selectedVoice: 'alloy' // default value
      },
      async (items) => {
        document.querySelector('#apiKey').value = items.openaiApiKey;
        document.querySelector('#model').value = items.selectedModel;
        document.querySelector('#voice').value = items.selectedVoice;
        // Update description for restored voice
        const description = voiceDescriptions[items.selectedVoice];
        document.querySelector('#voiceDescription').textContent = description;
  
        // Fetch models if API key exists
        if (items.openaiApiKey) {
          await fetchModels(items.openaiApiKey);
          document.querySelector('#model').value = items.selectedModel;
        }
      }
    );
  }
  
  // Fetch models when API key changes
  document.querySelector('#apiKey').addEventListener('input', async (event) => {
    const apiKey = event.target.value.trim();
    if (apiKey) {
      await fetchModels(apiKey);
    } else {
      document.querySelector('#model').innerHTML = '<option value="">Enter API key first</option>';
      document.querySelector('#modelStatus').textContent = '';
    }
  });
  
  document.addEventListener('DOMContentLoaded', restoreOptions);
  document.querySelector('#save').addEventListener('click', saveOptions);