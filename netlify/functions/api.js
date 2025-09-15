const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fileType = require('file-type');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// Use upload.any() to handle different types of file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // Increased limit for audio
}).any();

// --- Helper Functions ---

// Utility to wait
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Check if the transcribed text seems to be about ingredients
function isIngredientList(text) {
  if (!text || text.trim().length < 5) {
    return false;
  }
  const keywords = [
    'tomate', 'cebola', 'alho', 'arroz', 'feijão', 'carne', 'frango', 'peixe', 
    'ovo', 'leite', 'pão', 'farinha', 'açúcar', 'sal', 'pimenta', 'óleo', 
    'azeite', 'manteiga', 'batata', 'cenoura', 'abobrinha', 'brócolis', 
    'maçã', 'banana', 'laranja', 'limão', 'uva', 'queijo', 'presunto'
  ];
  const lowerText = text.toLowerCase();
  // Return true if at least one keyword is found
  return keywords.some(keyword => lowerText.includes(keyword));
}

// Transcribe audio using AssemblyAI
async function transcribeAudio(audioBuffer) {
  const assemblyai_key = process.env.ASSEMBLYAI_API_KEY;
  if (!assemblyai_key) {
    throw new Error('Chave da API do AssemblyAI não configurada.');
  }

  const assemblyai_api = axios.create({
    baseURL: "https://api.assemblyai.com/v2",
    headers: { "authorization": assemblyai_key },
  });

  console.log("Enviando áudio para AssemblyAI...");
  const uploadResponse = await assemblyai_api.post("/upload", audioBuffer);
  const audioUrl = uploadResponse.data.upload_url;

  console.log("Iniciando transcrição...");
  const transcriptResponse = await assemblyai_api.post("/transcript", {
    audio_url: audioUrl,
    speech_model: "universal",
  });
  const transcriptId = transcriptResponse.data.id;

  console.log(`Aguardando resultado da transcrição (ID: ${transcriptId})...`);
  while (true) {
    const pollResponse = await assemblyai_api.get(`/transcript/${transcriptId}`);
    const result = pollResponse.data;
    if (result.status === "completed") {
      console.log("Transcrição concluída.");
      return result.text;
    }
    if (result.status === "error") {
      throw new Error(`Falha na transcrição: ${result.error}`);
    }
    await sleep(3000); // Wait 3 seconds before polling again
  }
}

// Generic function to get recipes from OpenRouter
async function getRecipesFromAI(prompt) {
    const openrouter_key = process.env.OPENAI_API_KEY;
    if (!openrouter_key) {
        throw new Error('Chave da API da OpenRouter não configurada.');
    }

    const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
        "model": "qwen/qwen2.5-vl-32b-instruct:free",
        "messages": [ { "role": "user", "content": prompt } ]
    }, {
        headers: {
            "Authorization": `Bearer ${openrouter_key}`,
            "Content-Type": "application/json"
        }
    });
    
    const content = response.data.choices[0].message.content;
    if (!content) {
        throw new Error("A resposta da IA estava vazia.");
    }

    // Basic JSON extraction
    const startIndex = content.indexOf('{');
    const endIndex = content.lastIndexOf('}');
    if (startIndex === -1 || endIndex === -1) {
        throw new Error("Nenhum JSON válido encontrado na resposta da IA.");
    }
    const jsonString = content.substring(startIndex, endIndex + 1);
    return JSON.parse(jsonString);
}


// --- Main API Endpoint ---

app.post('/api/receitas', upload, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    const imageFile = req.files.find(f => f.fieldname === 'image');
    const audioFile = req.files.find(f => f.fieldname === 'audio');

    let recipeJson;

    if (audioFile) {
      // --- AUDIO WORKFLOW ---
      console.log("Iniciando fluxo de áudio...");
      const transcribedText = await transcribeAudio(audioFile.buffer);
      console.log("Texto transcrito:", transcribedText);

      if (!isIngredientList(transcribedText)) {
        console.log("O áudio não parece conter uma lista de ingredientes.");
        return res.status(400).json({ error: "O áudio não parece conter ingredientes. Por favor, fale uma lista de ingredientes." });
      }

      const prompt = `Você é um chef e nutricionista. A partir da seguinte lista de ingredientes: "${transcribedText}", sugira 2 receitas que usem o máximo desses ingredientes. Responda APENAS com um objeto JSON na seguinte estrutura, sem texto adicional: {"receitas": [{"nome": "...", "ingredientes_disponiveis": ["..."], "ingredientes_adicionais": ["..."], "modo_preparo": ["..."], "tempo_preparo": "..."}], "observacoes_gerais": "..."}`;
      
      recipeJson = await getRecipesFromAI(prompt);

    } else if (imageFile) {
      // --- IMAGE WORKFLOW ---
      console.log("Iniciando fluxo de imagem...");
      const imageBuffer = imageFile.buffer;
      const type = await fileType.fromBuffer(imageBuffer);
      if (!type) {
        return res.status(400).json({ error: 'Não foi possível determinar o tipo do arquivo de imagem.' });
      }

      const base64Image = imageBuffer.toString('base64');
      const mimeType = type.mime;

      const prompt = [
          { "type": "text", "text": `Você é um chef e nutricionista. Analise a imagem em anexo e sugira 2 receitas. Responda APENAS com um objeto JSON na seguinte estrutura, sem texto adicional: {"receitas": [{"nome": "...", "ingredientes_disponiveis": ["..."], "ingredientes_adicionais": ["..."], "modo_preparo": ["..."], "tempo_preparo": "..."}], "observacoes_gerais": "..."}` },
          { "type": "image_url", "image_url": { "url": `data:${mimeType};base64,${base64Image}` } }
      ];

      recipeJson = await getRecipesFromAI(prompt);

      // Content filter for images
      if (!recipeJson.receitas || recipeJson.receitas.length === 0 || !recipeJson.receitas[0].ingredientes_disponiveis || recipeJson.receitas[0].ingredientes_disponiveis.length === 0) {
          console.log("A IA não identificou ingredientes na imagem.");
          return res.status(400).json({ error: "A imagem não parece conter ingredientes culinários. Por favor, envie uma foto mais clara dos seus ingredientes." });
      }

    } else {
      return res.status(400).json({ error: 'Nenhum arquivo de imagem ou áudio válido foi enviado.' });
    }

    res.json(recipeJson);

  } catch (error) {
    console.error("--- ERRO GERAL NO ENDPOINT /api/receitas ---");
    console.error(error.message);
    if (error.response) { // Log axios errors
        console.error('Data:', error.response.data);
    }
    res.status(500).json({ error: 'Ocorreu um erro interno ao processar sua solicitação.' });
  }
});

const serverless = require('serverless-http');
module.exports.handler = serverless(app);