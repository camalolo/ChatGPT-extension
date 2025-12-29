// Browser voice management
let availableVoices = [];

// Load browser voices
function loadBrowserVoices() {
  availableVoices = speechSynthesis.getVoices();
  const voiceSelect = document.querySelector('#browserVoice');
  voiceSelect.innerHTML = '<option value="">Select a voice...</option>';

  for (const voice of availableVoices) {
    const option = document.createElement('option');
    option.value = `${voice.name}|||${voice.lang}`;
    option.textContent = `${voice.name} (${voice.lang})`;
    voiceSelect.append(option);
  }

  // Update description when selection changes
  voiceSelect.addEventListener('change', (event) => {
    const value = event.target.value;
    if (value) {
      const [name, lang] = value.split('|||');
      const voice = availableVoices.find(v => v.name === name && v.lang === lang);
      if (voice) {
        document.querySelector('#voiceDescription').textContent =
          `${voice.name} - ${voice.lang} (${voice.default ? 'Default' : 'Available'})`;
        return;
      }
    }
    document.querySelector('#voiceDescription').textContent = 'Select a browser voice for text-to-speech';
  });
}

// Load voices when they become available
if (speechSynthesis.onvoiceschanged !== undefined) {
  speechSynthesis.onvoiceschanged = loadBrowserVoices;
}
// Also try to load immediately in case voices are already available
loadBrowserVoices();

// LLM provider switching
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
  const apiKey = provider === 'openai' ? document.querySelector('#apiKey').value : document.querySelector('#sidepanelOpenrouterApiKey').value;
   if (apiKey) {
     const freeOnly = provider === 'openrouter' ? document.querySelector('#openrouterFreeOnly').checked : false;
     fetchAvailableModels(provider, apiKey, freeOnly);
   }
  updateOpenAISettingsVisibility();
}



// Update OpenAI settings visibility based on current provider selection
function updateOpenAISettingsVisibility() {
  const provider = document.querySelector('#sidepanelProvider').value;
  const openaiSettings = document.querySelector('#openai-settings');
  if (provider === 'openai') {
    document.querySelector('#sidepanel-openai-settings').append(openaiSettings);
    openaiSettings.style.display = 'block';
  } else {
    openaiSettings.style.display = 'none';
  }
}

// Fetch available models from API
async function fetchAvailableModels(provider, apiKey, freeOnly = false) {
  let modelSelect, modelStatus;
  if (provider === 'openai') {
    modelSelect = document.querySelector('#sidepanelModel');
    modelStatus = document.querySelector('#sidepanelModelStatus');
  } else {
    modelSelect = document.querySelector('#sidepanelOpenrouterModel');
    modelStatus = document.querySelector('#sidepanelOpenrouterModelStatus');
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
         .filter(model => freeOnly ? model.id.includes(':free') : true)
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
  document.querySelector('#browserVoice').addEventListener('change', (event) => {
    const value = event.target.value;
    if (value) {
      const [name, lang] = value.split('|||');
      const voice = availableVoices.find(v => v.name === name && v.lang === lang);
      if (voice) {
        document.querySelector('#voiceDescription').textContent =
          `${voice.name} - ${voice.lang} (${voice.default ? 'Default' : 'Available'})`;
        return;
      }
    }
    document.querySelector('#voiceDescription').textContent = 'Select a browser voice for text-to-speech';
  });
  
  // Validate API key by performing a test completion
  function validateAPI(provider, apiKey, model) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'validate_api', provider, apiKey, model }, (response) => {
        resolve(response);
      });
    });
  }

  // Saves options to chrome.storage
  async function saveOptions() {
    const apiKey = document.querySelector('#apiKey').value;
    const sidepanelProvider = document.querySelector('#sidepanelProvider').value;
    const browserVoice = document.querySelector('#browserVoice').value;
    const status = document.querySelector('#status');

    let settings = {
       openaiApiKey: apiKey,
       browserVoice: browserVoice,
       sidepanelProvider
     };

     // Add OpenRouter free only setting if OpenRouter is selected
     if (sidepanelProvider === 'openrouter') {
       settings.sidepanelOpenrouterFreeOnly = document.querySelector('#openrouterFreeOnly').checked;
     }

    // Validate based on providers
    let validationErrors = [];

    // Validate OpenAI API key if needed
    if (sidepanelProvider === 'openai' && !apiKey) {
      validationErrors.push('OpenAI API key is required.');
    }

    // Validate sidepanel settings
    if (sidepanelProvider === 'openai') {
      const model = document.querySelector('#sidepanelModel').value;
      if (model) {
        settings.sidepanelModel = model;
      } else {
        validationErrors.push('Please select a sidepanel model.');
      }
    } else if (sidepanelProvider === 'openrouter') {
      const openrouterApiKey = document.querySelector('#sidepanelOpenrouterApiKey').value;
      const model = document.querySelector('#sidepanelOpenrouterModel').value;
      if (!openrouterApiKey) {
        validationErrors.push('Please enter an OpenRouter API key for sidepanel.');
      }
      if (model) {
        settings.sidepanelOpenrouterApiKey = openrouterApiKey;
        settings.sidepanelOpenrouterModel = model;
      } else {
        validationErrors.push('Please select an OpenRouter model for sidepanel.');
      }
    }



    if (validationErrors.length > 0) {
      status.textContent = validationErrors.join(' ');
      status.style.color = '#dc2626';
      setTimeout(() => {
        status.textContent = '';
        status.style.color = '';
      }, 5000);
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

      // Validate API key by performing a test completion
      status.textContent = 'Validating API key...';
      const validation = await validateAPI('openai', apiKey, model);
      if (!validation.valid) {
        status.textContent = 'API key validation failed: ' + (validation.error || 'Unknown error');
        status.style.color = '#dc2626';
        setTimeout(() => {
          status.textContent = '';
          status.style.color = '';
        }, 5000);
        return;
      }

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

      // Validate API key by performing a test completion
      status.textContent = 'Validating API key...';
      const validation = await validateAPI('openrouter', sidepanelApiKey, model);
      if (!validation.valid) {
        status.textContent = 'API key validation failed: ' + (validation.error || 'Unknown error');
        status.style.color = '#dc2626';
        setTimeout(() => {
          status.textContent = '';
          status.style.color = '';
        }, 5000);
        return;
      }

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
         browserVoice: '', // default value
         sidepanelProvider: 'openai', // default value
         sidepanelModel: '', // default value
         sidepanelOpenrouterApiKey: '', // default value
         sidepanelOpenrouterModel: '', // default value
         sidepanelOpenrouterFreeOnly: false // default value
       },
      async (items) => {
        document.querySelector('#apiKey').value = items.openaiApiKey;

        // Wait for voices to load, then set the selected voice
        const setVoice = () => {
          if (availableVoices.length > 0) {
            document.querySelector('#browserVoice').value = items.browserVoice;
            const value = items.browserVoice;
            if (value) {
              const [name, lang] = value.split('|||');
              const voice = availableVoices.find(v => v.name === name && v.lang === lang);
              if (voice) {
                document.querySelector('#voiceDescription').textContent =
                  `${voice.name} - ${voice.lang} (${voice.default ? 'Default' : 'Available'})`;
              }
            }
          } else {
            // Retry if voices not loaded yet
            setTimeout(setVoice, 100);
          }
        };
        setVoice();

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
          document.querySelector('#openrouterFreeOnly').checked = items.sidepanelOpenrouterFreeOnly;
          // Fetch models if API key exists
          if (items.sidepanelOpenrouterApiKey) {
            await fetchAvailableModels('openrouter', items.sidepanelOpenrouterApiKey, items.sidepanelOpenrouterFreeOnly);
            document.querySelector('#sidepanelOpenrouterModel').value = items.sidepanelOpenrouterModel;
             }
           }
        updateOpenAISettingsVisibility();

        // Remove old grammar-specific keys to clean up
        chrome.storage.sync.remove([
          'grammarProvider',
          'customGrammarEndpoint',
          'customGrammarApiKey',
          'customGrammarModel',
          'openrouterGrammarApiKey',
          'openrouterGrammarModel'
        ]);
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
       const freeOnly = document.querySelector('#openrouterFreeOnly').checked;
       await fetchAvailableModels('openrouter', apiKey, freeOnly);
     } else {
       document.querySelector('#sidepanelOpenrouterModel').innerHTML = '<option value="">Enter API key first</option>';
       document.querySelector('#sidepanelOpenrouterModelStatus').textContent = '';
     }
    });

    // Refetch models when free only checkbox changes
    document.querySelector('#openrouterFreeOnly').addEventListener('change', async (event) => {
     const apiKey = document.querySelector('#sidepanelOpenrouterApiKey').value.trim();
     if (apiKey) {
       const currentSelection = document.querySelector('#sidepanelOpenrouterModel').value;
       await fetchAvailableModels('openrouter', apiKey, event.target.checked);
       // Restore selection if the model is still available in the filtered list
       const modelSelect = document.querySelector('#sidepanelOpenrouterModel');
       const options = [...modelSelect.options].map(option => option.value);
       if (currentSelection && options.includes(currentSelection)) {
         modelSelect.value = currentSelection;
       }
     }
    });



    document.addEventListener('DOMContentLoaded', restoreOptions);
    document.querySelector('#save').addEventListener('click', saveOptions);