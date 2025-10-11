// Voice descriptions
const voiceDescriptions = {
    alloy: "A neutral voice suitable for general use",
    echo: "A deep and resonant voice",
    fable: "A soft and gentle voice",
    onyx: "A professional and authoritative voice",
    nova: "A warm and welcoming voice",
    shimmer: "A clear and bright voice"
  };

// Sidepanel provider switching
function switchSidepanelProvider(provider) {
  const openaiSettings = document.querySelector('#sidepanel-openai-settings');
  const openrouterSettings = document.querySelector('#sidepanel-openrouter-settings');
  if (provider === 'openai') {
    openaiSettings.style.display = 'block';
    openrouterSettings.style.display = 'none';
  } else {
    openaiSettings.style.display = 'none';
    openrouterSettings.style.display = 'block';
  }
}

// Fetch available models from API
async function fetchAvailableModels(provider, apiKey, isSidepanel = false) {
  let modelSelect, modelStatus;
  if (provider === 'openai') {
    modelSelect = isSidepanel ? document.querySelector('#sidepanelModel') : document.querySelector('#model');
    modelStatus = isSidepanel ? document.querySelector('#sidepanelModelStatus') : document.querySelector('#modelStatus');
  } else {
    modelSelect = isSidepanel ? document.querySelector('#sidepanelOpenrouterModel') : document.querySelector('#openrouterModel');
    modelStatus = isSidepanel ? document.querySelector('#sidepanelOpenrouterModelStatus') : document.querySelector('#openrouterModelStatus');
  }

  if ((provider === 'openai' || provider === 'openrouter') && !apiKey) {
    modelSelect.innerHTML = '<option value="">Enter API key first</option>';
    modelStatus.textContent = '';
    return false;
  }

  modelStatus.textContent = 'Loading models...';
  modelStatus.style.color = '#666';

  try {
    let url, headers = {};
    if (provider === 'openai') {
      url = 'https://api.openai.com/v1/models';
      headers['Authorization'] = `Bearer ${apiKey}`;
    } else if (provider === 'openrouter') {
      url = 'https://openrouter.ai/api/v1/models';
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    let models;
    if (provider === 'openai') {
      models = data.data
        .filter(model => model.id.startsWith('gpt-'))
        .toSorted((a, b) => a.id.localeCompare(b.id))
        .map(model => model.id);
    } else if (provider === 'openrouter') {
      models = data.data
        .toSorted((a, b) => a.id.localeCompare(b.id))
        .map(model => model.id);
    }

    modelSelect.innerHTML = '<option value="">Select a model...</option>';
    for (const model of models) {
      const option = document.createElement('option');
      option.value = model;
      option.textContent = model;
      modelSelect.append(option);
    }

    modelStatus.textContent = `Loaded ${models.length} models`;
    modelStatus.style.color = '#16a34a';
    return true;
  } catch (error) {
    console.error('Error fetching models:', error);
    modelSelect.innerHTML = '<option value="">Failed to load models</option>';
    modelStatus.textContent = 'Invalid credentials or network error';
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
   const sidepanelProvider = document.querySelector('#sidepanelProvider').value;
   const voice = document.querySelector('#voice').value;
   const status = document.querySelector('#status');

   let settings = { openaiApiKey: apiKey, selectedVoice: voice, sidepanelProvider };

   // Validate OpenAI API key (required for TTS and grammar fix)
   if (!apiKey) {
     status.textContent = 'Please enter an OpenAI API key.';
     status.style.color = '#dc2626';
     setTimeout(() => {
       status.textContent = '';
       status.style.color = '';
     }, 3000);
     return;
   }

   if (sidepanelProvider === 'openai') {
     const model = document.querySelector('#sidepanelModel').value;

     if (!model) {
       status.textContent = 'Please select a sidepanel model.';
       status.style.color = '#dc2626';
       setTimeout(() => {
         status.textContent = '';
         status.style.color = '';
       }, 3000);
       return;
     }

     // Validate API key and model by fetching models
     status.textContent = 'Validating...';
     const isValid = await fetchAvailableModels('openai', apiKey, true);
     if (!isValid) {
       status.textContent = 'Validation failed. Check your OpenAI API key.';
       status.style.color = '#dc2626';
       setTimeout(() => {
         status.textContent = '';
         status.style.color = '';
       }, 3000);
       return;
     }

     // Re-select the model after validation
     document.querySelector('#sidepanelModel').value = model;

     settings.sidepanelModel = model;
   } else {
     const sidepanelApiKey = document.querySelector('#sidepanelOpenrouterApiKey').value;
     const model = document.querySelector('#sidepanelOpenrouterModel').value;

     if (!sidepanelApiKey) {
       status.textContent = 'Please enter an OpenRouter API key.';
       status.style.color = '#dc2626';
       setTimeout(() => {
         status.textContent = '';
         status.style.color = '';
       }, 3000);
       return;
     }

     if (!model) {
       status.textContent = 'Please select an OpenRouter model.';
       status.style.color = '#dc2626';
       setTimeout(() => {
         status.textContent = '';
         status.style.color = '';
       }, 3000);
       return;
     }

     // Validate API key and model by fetching models
     status.textContent = 'Validating...';
     const isValid = await fetchAvailableModels('openrouter', sidepanelApiKey, true);
     if (!isValid) {
       status.textContent = 'Validation failed. Check your OpenRouter API key.';
       status.style.color = '#dc2626';
       setTimeout(() => {
         status.textContent = '';
         status.style.color = '';
       }, 3000);
       return;
     }

     // Re-select the model after validation
     document.querySelector('#sidepanelOpenrouterModel').value = model;

     settings.sidepanelOpenrouterApiKey = sidepanelApiKey;
     settings.sidepanelOpenrouterModel = model;
   }

   chrome.storage.sync.set(settings, () => {
     // Update status to let user know options were saved.
     status.textContent = 'Settings saved.';
     status.style.color = '#16a34a';
     setTimeout(() => {
       status.textContent = '';
       status.style.color = '';
     }, 2000);
   });
 }
  
  // Restores select box and checkbox state using the preferences
  // stored in chrome.storage.
  async function restoreOptions() {
   chrome.storage.sync.get(
     {
       openaiApiKey: '', // default value
       selectedVoice: 'alloy', // default value
       sidepanelProvider: 'openai', // default value
       sidepanelModel: '', // default value
       sidepanelOpenrouterApiKey: '', // default value
       sidepanelOpenrouterModel: '' // default value
     },
     async (items) => {
       document.querySelector('#apiKey').value = items.openaiApiKey;
       document.querySelector('#voice').value = items.selectedVoice;
       // Update description for restored voice
       const description = voiceDescriptions[items.selectedVoice];
       document.querySelector('#voiceDescription').textContent = description;

       document.querySelector('#sidepanelProvider').value = items.sidepanelProvider;
       switchSidepanelProvider(items.sidepanelProvider);

       if (items.sidepanelProvider === 'openai') {
         document.querySelector('#sidepanelModel').value = items.sidepanelModel;
         // Fetch models if API key exists
         if (items.openaiApiKey) {
           await fetchAvailableModels('openai', items.openaiApiKey, true);
           document.querySelector('#sidepanelModel').value = items.sidepanelModel;
         }
       } else {
         document.querySelector('#sidepanelOpenrouterApiKey').value = items.sidepanelOpenrouterApiKey;
         document.querySelector('#sidepanelOpenrouterModel').value = items.sidepanelOpenrouterModel;
         // Fetch models if API key exists
         if (items.sidepanelOpenrouterApiKey) {
           await fetchAvailableModels('openrouter', items.sidepanelOpenrouterApiKey, true);
           document.querySelector('#sidepanelOpenrouterModel').value = items.sidepanelOpenrouterModel;
         }
       }
     }
   );
 }
  
  // Sidepanel provider change
  document.querySelector('#sidepanelProvider').addEventListener('change', (event) => {
   switchSidepanelProvider(event.target.value);
 });

  // Fetch models when OpenAI API key changes (for sidepanel if openai)
  document.querySelector('#apiKey').addEventListener('input', async (event) => {
   const apiKey = event.target.value.trim();
   const sidepanelProvider = document.querySelector('#sidepanelProvider').value;
   if (apiKey && sidepanelProvider === 'openai') {
     await fetchAvailableModels('openai', apiKey, true);
   } else if (sidepanelProvider === 'openai') {
     document.querySelector('#sidepanelModel').innerHTML = '<option value="">Enter API key first</option>';
     document.querySelector('#sidepanelModelStatus').textContent = '';
   }
  });

  // Fetch models when OpenRouter API key changes
  document.querySelector('#sidepanelOpenrouterApiKey').addEventListener('input', async (event) => {
   const apiKey = event.target.value.trim();
   if (apiKey) {
     await fetchAvailableModels('openrouter', apiKey, true);
   } else {
     document.querySelector('#sidepanelOpenrouterModel').innerHTML = '<option value="">Enter API key first</option>';
     document.querySelector('#sidepanelOpenrouterModelStatus').textContent = '';
   }
  });

  document.addEventListener('DOMContentLoaded', restoreOptions);
  document.querySelector('#save').addEventListener('click', saveOptions);