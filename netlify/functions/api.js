const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fileType = require('file-type');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

app.post('/api/receitas', upload.single('image'), async (req, res) => {
  console.log("Iniciando o processamento da receita...");

  // 1. Verificar a chave da API
  if (!process.env.OPENAI_API_KEY) {
    console.error("A variável de ambiente OPENAI_API_KEY não está definida.");
    return res.status(500).json({ error: 'Erro de configuração do servidor: a chave da API não foi encontrada.' });
  }
  console.log("Chave da API encontrada.");

  let rawResponseContent = '';
  try {
    if (!req.file) {
      console.log("Nenhum arquivo de imagem enviado.");
      return res.status(400).json({ error: 'Nenhuma imagem enviada.' });
    }
    console.log("Arquivo de imagem recebido.");

    const imageBuffer = req.file.buffer;
    const type = await fileType.fromBuffer(imageBuffer);

    if (!type) {
      console.log("Não foi possível determinar o tipo do arquivo.");
      return res.status(400).json({ error: 'Não foi possível determinar o tipo do arquivo.' });
    }
    console.log(`Tipo de arquivo detectado: ${type.mime}`);

    const base64Image = imageBuffer.toString('base64');
    const mimeType = type.mime;

    console.log("Enviando requisição para a API da OpenRouter...");
    const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
      "model": "qwen/qwen2.5-vl-32b-instruct:free",
      "messages": [
        {
          "role": "user",
          "content": [
            {
              "type": "text",
              "text": `Você é um chef e nutricionista. Analise a imagem em anexo e siga as instruções abaixo.

1.  **Análise de Imagem:** Identifique cada ingrediente na imagem, estime a quantidade e avalie a qualidade/frescor.
2.  **Sugestão de Receitas:** Com base na análise, sugira 2 receitas que usem o máximo dos ingredientes disponíveis.
3.  **Formato da Resposta:** A sua resposta deve ser um objeto JSON, e NADA MAIS. O JSON deve ter a seguinte estrutura:

{"receitas": [{"nome": "...", "ingredientes_disponiveis": ["..."], "ingredientes_adicionais": ["..."], "modo_preparo": ["..."], "tempo_preparo": "..."}], "observacoes_gerais": "..."}

**Regras Adicionais:**
*   Para cada receita, liste no máximo 5 ingredientes adicionais que sejam comuns (sal, pimenta, azeite, etc.).
*   O "modo_preparo" deve ser uma lista de passos claros e concisos.
*   Responda APENAS com o JSON. Não inclua texto antes ou depois do objeto JSON.`
            },
            {
              "type": "image_url",
              "image_url": {
                "url": `data:${mimeType};base64,${base64Image}`
              }
            }
          ]
        }
      ]
    }, {
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "HTTP-Referer": "https://receitas-com-ia.vercel.app", // You might want to change this to your Netlify URL
        "X-Title": "Receitas com IA",
        "Content-Type": "application/json"
      }
    });

    console.log("Requisição para a OpenRouter bem-sucedida.");
    const completion = response.data;
    console.log("Resposta completa da IA:", JSON.stringify(completion, null, 2));

    if (completion.choices && completion.choices.length > 0 && completion.choices[0].message) {
      rawResponseContent = completion.choices[0].message.content;
      console.log("Conteúdo bruto da resposta da IA recebido.");
      // Log a snippet of the response to avoid flooding logs
      console.log("Início da resposta da IA:", rawResponseContent.substring(0, 100));
    } else {
      console.error("Resposta da IA em formato inesperado:", completion);
      throw new Error("Formato de resposta da IA inválido.");
    }

    // Custom JSON parsing logic
    let parsedJson;
    try {
      console.log("Tentando extrair e analisar o JSON da resposta.");
      const startIndex = rawResponseContent.indexOf('{');
      const endIndex = rawResponseContent.lastIndexOf('}');
      if (startIndex !== -1 && endIndex !== -1) {
        const jsonSubstring = rawResponseContent.substring(startIndex, endIndex + 1);
        parsedJson = JSON.parse(jsonSubstring);
        console.log("JSON analisado com sucesso.");
      } else {
        console.error("Nenhum objeto JSON encontrado na resposta da IA.");
        throw new Error('Objeto JSON não encontrado na resposta.');
      }
    } catch (jsonError) {
      console.error("Erro ao analisar o JSON da resposta bruta:", jsonError);
      console.error("Conteúdo bruto que falhou na análise:", rawResponseContent);
      throw new Error('A resposta da IA não é um JSON válido ou está incompleta.');
    }

    res.json(parsedJson);

  } catch (error) {
    console.error("--- ERRO GERAL NO CATCH ---");
    if (error instanceof multer.MulterError) {
      console.error("Erro do Multer:", error.message);
      return res.status(400).json({ error: `Erro no upload da imagem: ${error.message}` });
    }
    
    // Log de erro do Axios
    if (error.isAxiosError) {
      console.error("Erro do Axios ao chamar a API externa.");
      if (error.response) {
        // A requisição foi feita e o servidor respondeu com um status code fora do range 2xx
        console.error('Status:', error.response.status);
        console.error('Data:', error.response.data);
        console.error('Headers:', error.response.headers);
      } else if (error.request) {
        // A requisição foi feita mas nenhuma resposta foi recebida
        console.error('Request:', error.request);
      } else {
        // Algo aconteceu ao configurar a requisição que acionou um erro
        console.error('Erro de configuração do Axios:', error.message);
      }
    } else {
      // Log de outros erros
      console.error("Erro não relacionado ao Axios:", error);
    }

    console.error("Conteúdo bruto da resposta (se disponível no momento do erro):", rawResponseContent);
    res.status(500).json({ error: 'Erro interno ao processar a sua requisição. Verifique os logs da função para mais detalhes.' });
  }
});

const serverless = require('serverless-http');
module.exports.handler = serverless(app);

