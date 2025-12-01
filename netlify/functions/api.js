const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fileType = require('file-type');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// --- Supabase Admin Client Initialization ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const app = express();
app.use(cors());

// --- Stripe Webhook Endpoint (MUST BE BEFORE express.json()) ---
app.post('/api/stripe-webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.error(`❌ Erro na verificação da assinatura do webhook: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Mapeamento de Price IDs para nomes de planos no seu banco de dados
    const priceIdToPlan = {
        'price_1SZH7kCweAPPqyx8oyf30gyS': 'basic',
        'price_1SZHA1CweAPPqyx85E8PUoAe': 'pro',
        'price_1SZHCFCweAPPqyx8J7tNYsV4': 'premium'
    };

    // Handle the event
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const customerId = session.customer;
        
        // Para obter o priceId, precisamos expandir o line_items na chamada da API ou buscá-lo
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
        const priceId = lineItems.data[0].price.id;
        const plan = priceIdToPlan[priceId];

        if (!plan) {
            console.error(`Plano não encontrado para o Price ID: ${priceId}`);
        } else {
            try {
                const { error } = await supabaseAdmin
                    .from('profiles')
                    .update({ plan: plan })
                    .eq('stripe_customer_id', customerId);

                if (error) {
                    console.error('Falha ao atualizar o plano do usuário no Supabase:', error.message);
                } else {
                    console.log(`Plano do usuário ${customerId} atualizado para ${plan}`);
                }
            } catch (dbError) {
                console.error('Erro no banco de dados ao atualizar plano:', dbError.message);
            }
        }
    }

    res.status(200).json({ received: true });
});


// --- Global Middlewares & Configs ---
app.use(express.json({ limit: '10mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, 
});

// --- Plan Limits ---
const PLAN_LIMITS = {
    free: 3,
    basic: 10,
    pro: 30,
    premium: 50,
};

// --- Middlewares ---

const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Não autorizado: Token não fornecido.' });
    }
    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error) {
        return res.status(401).json({ error: `Não autorizado: ${error.message}` });
    }
    if (!user) {
        return res.status(401).json({ error: 'Não autorizado: Usuário não encontrado.' });
    }
    req.user = user;
    next();
};

const limitMiddleware = async (req, res, next) => {
    try {
        const { id } = req.user;
        const today = new Date().toISOString().split('T')[0];

        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('plan, daily_generation_count, last_generation_date')
            .eq('id', id)
            .single();

        if (profileError || !profile) {
            return res.status(500).json({ error: 'Não foi possível encontrar o perfil do usuário.' });
        }

        let { plan, daily_generation_count, last_generation_date } = profile;
        
        // Reset count if it's a new day
        if (last_generation_date !== today) {
            daily_generation_count = 0;
        }

        const limit = PLAN_LIMITS[plan] || 0;

        if (daily_generation_count >= limit) {
            return res.status(429).json({ error: `Você atingiu seu limite de ${limit} gerações diárias. Faça um upgrade para gerar mais.` });
        }

        // Increment count and update date
        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({ 
                daily_generation_count: daily_generation_count + 1,
                last_generation_date: today 
            })
            .eq('id', id);

        if (updateError) {
            // Log the error but don't block the user for this
            console.error('Failed to update generation count:', updateError.message);
        }

        next();
    } catch (error) {
        res.status(500).json({ error: `Erro no middleware de limite: ${error.message}` });
    }
};


// --- Helper Functions ---

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function getExpandedIngredientList() {
    // Expanded list of common Brazilian ingredients
    return [
        'tomate', 'cebola', 'alho', 'pimentão', 'cenoura', 'batata', 'mandioca', 'aipim', 'macaxeira',
        'abóbora', 'abobrinha', 'berinjela', 'chuchu', 'beterraba', 'milho', 'ervilha', 'vagem',
        'brócolis', 'couve-flor', 'repolho', 'alface', 'rúcula', 'agrião', 'espinafre', 'couve',
        'cheiro-verde', 'salsinha', 'cebolinha', 'coentro', 'manjericão', 'hortelã', 'alecrim',
        'inhame', 'cará', 'palmito', 'pepino', 'quiabo', 'jiló', 'maxixe', 'carne bovina', 'carne moída', 'bife', 'costela', 'músculo', 'carne de porco', 'lombo', 'bisteca',
        'linguiça', 'bacon', 'frango', 'peito de frango', 'coxa de frango', 'sobrecoxa', 'asa de frango',
        'peru', 'pato', 'cordeiro', 'peixe', 'tilápia', 'salmão', 'sardinha', 'atum', 'bacalhau', 'camarão', 'lula', 'polvo', 'marisco', 'mexilhão',
        'arroz', 'feijão', 'lentilha', 'grão-de-bico', 'soja', 'trigo', 'aveia', 'quinoa', 'milho de pipoca',
        'farinha de trigo', 'farinha de mandioca', 'farinha de milho', 'fubá', 'tapioca', 'leite', 'queijo', 'mussarela', 'queijo prato', 'parmesão', 'requeijão', 'cream cheese', 'creme de leite',
        'iogurte', 'manteiga', 'margarina', 'ovo', 'ovos', 'banana', 'maçã', 'laranja', 'limão', 'mamão', 'melão', 'melancia', 'abacaxi', 'manga', 'uva', 'morango',
        'abacate', 'maracujá', 'goiaba', 'caju', 'acerola', 'açaí', 'pêssego', 'ameixa', 'figo', 'pão', 'macarrão', 'açúcar', 'sal', 'pimenta', 'óleo', 'azeite', 'vinagre', 'fermento', 'gelatina',
        'chocolate', 'café', 'mel', 'molho de tomate', 'mostarda', 'ketchup', 'maionese', 'amendoim', 'castanha'
    ];
}

function isIngredientList(text) {
  if (!text || text.trim().length < 3) return false;
  const keywords = getExpandedIngredientList();
  const lowerText = text.toLowerCase();
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

    let response;
    try {
        response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model: "google/gemma-3-4b-it:free",
            messages: [{ role: "user", content: promptContent }]
        }, {
            headers: { Authorization: `Bearer ${openrouter_key}`, "Content-Type": "application/json" }
        });
    } catch (axiosError) {
        console.error("OpenRouter API Request Failed:", axiosError.message);
        if (axiosError.response) {
            console.error("OpenRouter Response Data:", axiosError.response.data);
            console.error("OpenRouter Response Status:", axiosError.response.status);
            throw new Error(`OpenRouter API Error: ${axiosError.response.status} - ${axiosError.response.data.message || axiosError.message}`);
        } else if (axiosError.request) {
            throw new Error("OpenRouter API Error: No response received from API.");
        } else {
            throw new Error("OpenRouter API Error: " + axiosError.message);
        }
    }
    
    const content = response.data.choices[0].message.content;
    if (!content) throw new Error("A resposta da IA estava vazia.");

    const startIndex = content.indexOf('{');
    const endIndex = content.lastIndexOf('}');
    if (startIndex === -1 || endIndex === -1) {
        throw new Error("Nenhum JSON válido encontrado na resposta da IA. Resposta completa: " + content);
    }
    
    try {
        return JSON.parse(content.substring(startIndex, endIndex + 1));
    } catch (jsonError) {
        throw new Error("Falha ao analisar a resposta da IA como JSON. Erro: " + jsonError.message + ". Resposta completa: " + content);
    }
}

// --- API Endpoints ---

app.get('/api/config', (req, res) => {
    res.json({
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
        stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    });
});

app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo de áudio enviado.' });

        const transcribedText = await transcribeAudio(req.file.buffer);
        if (!isIngredientList(transcribedText)) {
            return res.status(400).json({ error: `O áudio ("${transcribedText}") não parece conter ingredientes. Por favor, grave uma lista de ingredientes.` });
        }
        res.json({ transcribedText });

    } catch (error) {
        console.error("--- ERRO DETALHADO EM /api/transcribe ---", error);
        res.status(500).json({ error: error.message });
    }
});

// Protected endpoint to generate recipes
app.post('/api/receitas', authMiddleware, limitMiddleware, async (req, res) => {
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

// --- Stripe Endpoints ---

app.post('/api/create-checkout-session', authMiddleware, async (req, res) => {
    try {
        const { priceId } = req.body;
        if (!priceId) {
            return res.status(400).json({ error: 'Price ID não fornecido.' });
        }

        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('stripe_customer_id')
            .eq('id', req.user.id)
            .single();

        if (profileError || !profile) {
            return res.status(500).json({ error: 'Não foi possível encontrar o perfil do usuário.' });
        }

        let customerId = profile.stripe_customer_id;

        // If the user is not a Stripe customer yet, create one
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: req.user.email,
                metadata: { supabaseId: req.user.id }
            });
            customerId = customer.id;

            // Save the new customer ID to the user's profile in Supabase
            const { error: updateError } = await supabaseAdmin
                .from('profiles')
                .update({ stripe_customer_id: customerId })
                .eq('id', req.user.id);

            if (updateError) {
                console.error('Erro ao salvar o Stripe Customer ID no Supabase:', updateError.message);
                return res.status(500).json({ error: 'Falha ao atualizar o perfil do usuário com o ID de cliente.' });
            }
        }

        // Create a checkout session
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            payment_method_types: ['card'],
            line_items: [{
                price: priceId,
                quantity: 1,
            }],
            mode: 'subscription',
            // IMPORTANT: Replace with your actual site URLs
            success_url: `${process.env.SITE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.SITE_URL}/cancel.html`,
        });

        res.json({ id: session.id });

    } catch (error) {
        console.error('Erro ao criar a sessão de checkout do Stripe:', error.message);
        res.status(500).json({ error: `Erro interno do servidor: ${error.message}` });
    }
});

const serverless = require('serverless-http');
module.exports.handler = serverless(app);
