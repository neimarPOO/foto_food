const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fileType = require('file-type');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

app.post('/api/receitas', upload.single('image'), async (req, res) => {
  let rawResponseContent = '';
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhuma imagem enviada.' });
    }

    const imageBuffer = req.file.buffer;
    const type = await fileType.fromBuffer(imageBuffer);

    if (!type) {
        return res.status(400).json({ error: 'Não foi possível determinar o tipo do arquivo.' });
    }

    const base64Image = imageBuffer.toString('base64');
    const mimeType = type.mime;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "HTTP-Referer": "https://receitas-com-ia.vercel.app",
        "X-Title": "Receitas com IA",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        "model": "qwen/qwen2.5-vl-32b-instruct:free",
        "messages": [
          {
            "role": "user",
            "content": [
              {
                "type": "text",
                "text": "Analise a imagem dos ingredientes e sugira 2-3 receitas. A resposta deve ser um JSON com a seguinte estrutura: {\"receitas\": [{\"nome\": \"...\", \"ingredientes_disponiveis\": [\"...\"], \"ingredientes_adicionais\": [\"...\"], \"modo_preparo\": [\"...\"], \"tempo_preparo\": \"...\"}], \"observacoes_gerais\": \"...\"}. Responda APENAS com o JSON válido, sem texto adicional antes ou depois."
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
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Error from OpenRouter API:", errorData);
      throw new Error(`API request failed with status ${response.status}`);
    }

    const completion = await response.json();

    rawResponseContent = completion.choices[0].message.content;

    // Custom JSON parsing logic
    let parsedJson;
    try {
      const startIndex = rawResponseContent.indexOf('{');
      const endIndex = rawResponseContent.lastIndexOf('}');
      if (startIndex !== -1 && endIndex !== -1) {
        const jsonSubstring = rawResponseContent.substring(startIndex, endIndex + 1);
        parsedJson = JSON.parse(jsonSubstring);
      } else {
        throw new Error('JSON object not found in response.');
      }
    } catch (jsonError) {
      console.error("Error parsing JSON from raw response:", jsonError);
      console.error("Raw response content:", rawResponseContent);
      throw new Error('Resposta da IA não é um JSON válido ou está incompleta.');
    }

    res.json(parsedJson);

  } catch (error) {
    if (error instanceof multer.MulterError) {
      return res.status(400).json({ error: `Erro no upload da imagem: ${error.message}` });
    }
    console.error("Error in /api/receitas:", error);
    console.error("Raw response content (if available):", rawResponseContent);
    res.status(500).json({ error: 'Erro ao processar a resposta da IA. Tente uma imagem diferente.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
