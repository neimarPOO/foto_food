const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fileType = require('file-type');
const axios = require('axios');

const app = express();
app.use(cors());
// Increase body size limit for base64 images
app.use(express.json({ limit: '10mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, 
});

// --- Helper Functions ---

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function getExpandedIngredientList() {
    // Expanded list of common Brazilian ingredients
    return [
        // Legumes e Verduras
        'tomate', 'cebola', 'alho', 'pimentão', 'cenoura', 'batata', 'mandioca', 'aipim', 'macaxeira',
        'abóbora', 'abobrinha', 'berinjela', 'chuchu', 'beterraba', 'milho', 'ervilha', 'vagem',
        'brócolis', 'couve-flor', 'repolho', 'alface', 'rúcula', 'agrião', 'espinafre', 'couve',
        'cheiro-verde', 'salsinha', 'cebolinha', 'coentro', 'manjericão', 'hortelã', 'alecrim',
        'inhame', 'cará', 'palmito', 'pepino', 'quiabo', 'jiló', 'maxixe',

        // Carnes e Aves
        'carne bovina', 'carne moída', 'bife', 'costela', 'músculo', 'carne de porco', 'lombo', 'bisteca',
        'linguiça', 'bacon', 'frango', 'peito de frango', 'coxa de frango', 'sobrecoxa', 'asa de frango',
        'peru', 'pato', 'cordeiro',

        // Peixes e Frutos do Mar
        'peixe', 'tilápia', 'salmão', 'sardinha', 'atum', 'bacalhau', 'camarão', 'lula', 'polvo', 'marisco', 'mexilhão',

        // Grãos e Cereais
        'arroz', 'feijão', 'lentilha', 'grão-de-bico', 'soja', 'trigo', 'aveia', 'quinoa', 'milho de pipoca',
        'farinha de trigo', 'farinha de mandioca', 'farinha de milho', 'fubá', 'tapioca',

        // Laticínios e Ovos
        'leite', 'queijo', 'mussarela', 'queijo prato', 'parmesão', 'requeijão', 'cream cheese', 'creme de leite',
        'iogurte', 'manteiga', 'margarina', 'ovo', 'ovos',

        // Frutas
        'banana', 'maçã', 'laranja', 'limão', 'mamão', 'melão', 'melancia', 'abacaxi', 'manga', 'uva', 'morango',
        'abacate', 'maracujá', 'goiaba', 'caju', 'acerola', 'açaí', 'pêssego', 'ameixa', 'figo',

        // Outros
        'pão', 'macarrão', 'açúcar', 'sal', 'pimenta', 'óleo', 'azeite', 'vinagre', 'fermento', 'gelatina',
        'chocolate', 'café', 'mel', 'molho de tomate', 'mostarda', 'ketchup', 'maionese', 'amendoim', 'castanha'
    ];
}

function isIngredientList(text) {
  if (!text || text.trim().length < 3) return false;
  const keywords = getExpandedIngredientList();
  const lowerText = text.toLowerCase();
  // Check for at least one match
  return keywords.some(keyword => lowerText.includes(keyword));
}

async function transcribeAudio(audioBuffer) {
  const assemblyai_key = process.env.ASSEMBLYAI_API_KEY;
  if (!assemblyai_key) throw new Error('Chave da API do AssemblyAI não configurada.');

  const assemblyai_api = axios.create({ baseURL: "https://api.assemblyai.com/v2", headers: { "authorization": assemblyai_key } });

  const uploadResponse = await assemblyai_api.post("/upload", audioBuffer);
  const transcriptResponse = await assemblyai_api.post("/transcript", { audio_url: uploadResponse.data.upload_url, language_code: "pt" });

  const transcriptId = transcriptResponse.data.id;
  while (true) {
    const pollResponse = await assemblyai_api.get(`/transcript/${transcriptId}`);
    const result = pollResponse.data;
    if (result.status === "completed") return result.text;
    if (result.status === "error") throw new Error(`Falha na transcrição: ${result.error}`);
    await sleep(2000);
  }
}

async function getRecipesFromAI(promptContent) {
    const openrouter_key = process.env.OPENAI_API_KEY;
    if (!openrouter_key) throw new Error('Chave da API da OpenRouter não configurada.');

    const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
        model: "google/gemma-3-4b-it:free",
        messages: [{ role: "user", content: promptContent }]
    }, {
        headers: { Authorization: `Bearer ${openrouter_key}`, "Content-Type": "application/json" }
    });
    
    const content = response.data.choices[0].message.content;
    if (!content) throw new Error("A resposta da IA estava vazia.");

    const startIndex = content.indexOf('{');
    const endIndex = content.lastIndexOf('}');
    if (startIndex === -1 || endIndex === -1) throw new Error("Nenhum JSON válido encontrado na resposta da IA.");
    
    return JSON.parse(content.substring(startIndex, endIndex + 1));
}

// --- API Endpoints ---

// Endpoint to transcribe audio and validate ingredients
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo de áudio enviado.' });

        const transcribedText = await transcribeAudio(req.file.buffer);
        if (!isIngredientList(transcribedText)) {
            return res.status(400).json({ error: `O áudio ("${transcribedText}") não parece conter ingredientes. Por favor, grave uma lista de ingredientes.` });
        }
        res.json({ transcribedText });

    } catch (error) {
        console.error("--- ERRO DETALHADO EM /api/transcribe ---");
        if (error.response) {
            console.error("Data:", error.response.data);
            console.error("Status:", error.response.status);
            const errorMessage = error.response.data.error || error.message;
            res.status(500).json({ error: `Erro da API de Transcrição: ${errorMessage}` });
        } else if (error.request) {
            console.error("Request:", error.request);
            res.status(500).json({ error: "Nenhuma resposta recebida da API de transcrição." });
        } else {
            console.error("Error", error.message);
            res.status(500).json({ error: error.message });
        }
    }
});

// Endpoint to generate recipes from text or image
app.post('/api/receitas', async (req, res) => {
    try {
        const { text, image, currentIngredients = [] } = req.body;
        let promptContent;
        let recipeJson;

        if (text) {
            const ingredients = [...new Set([...currentIngredients, ...text.split(/, | e /)])].join(', ');
            promptContent = `Você é um chef e nutricionista. A partir da seguinte lista de ingredientes: "${ingredients}", sugira 3 receitas. Responda APENAS com um objeto JSON na estrutura: {"receitas": [{"nome": "...", "ingredientes_disponiveis": ["..."], "ingredientes_adicionais": ["..."], "modo_preparo": ["..."], "tempo_preparo": "..."}], "observacoes_gerais": "..."}`;
            recipeJson = await getRecipesFromAI(promptContent);
        } else if (image) {
            const imageBuffer = Buffer.from(image, 'base64');
            const type = await fileType.fromBuffer(imageBuffer);
            if (!type) return res.status(400).json({ error: 'Tipo de arquivo de imagem inválido.' });

            promptContent = [
                { type: "text", text: `Você é um chef e nutricionista. Analise a imagem e sugira 3 receitas. Considere também estes ingredientes já disponíveis: ${currentIngredients.join(', ')}. Responda APENAS com um objeto JSON na estrutura: {"receitas": [{"nome": "...", "ingredientes_disponiveis": ["..."], "ingredientes_adicionais": ["..."], "modo_preparo": ["..."], "tempo_preparo": "..."}], "observacoes_gerais": "..."}` },
                { type: "image_url", image_url: { url: `data:${type.mime};base64,${image}` } }
            ];
            recipeJson = await getRecipesFromAI(promptContent);
            recipeJson.inputImage = `data:${type.mime};base64,${image}`;

            if (!recipeJson.receitas || recipeJson.receitas.length === 0 || !recipeJson.receitas[0].ingredientes_disponiveis || recipeJson.receitas[0].ingredientes_disponiveis.length === 0) {
                return res.status(400).json({ error: "A imagem não parece conter ingredientes culinários. Por favor, envie uma foto mais clara." });
            }
        } else {
            return res.status(400).json({ error: 'Requisição inválida. Forneça texto ou imagem.' });
        }

        res.json(recipeJson);

    } catch (error) {
        console.error("Erro em /api/receitas:", error.message);
        res.status(500).json({ error: error.message });
    }
});

const serverless = require('serverless-http');
module.exports.handler = serverless(app);
