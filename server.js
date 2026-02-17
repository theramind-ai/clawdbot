import express from "express";
import fetch from "node-fetch"; // npm install node-fetch@3 (ou use native fetch no Node 18+)
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "seu-verify-token-aqui"; // Coloque no Render também
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const GRAPH_API_VERSION = "v21.0"; // Atualize para a versão mais recente (confira em developers.facebook.com)

// Função auxiliar para enviar mensagem de texto via WhatsApp Cloud API
async function sendWhatsAppMessage(to, text) {
  const url = `https://graph.facebook.com/\( {GRAPH_API_VERSION}/ \){PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: to,
    type: "text",
    text: {
      preview_url: false, // se quiser preview de links, mude para true
      body: text,
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Erro ao enviar mensagem WhatsApp:", data);
      throw new Error(`WhatsApp API error: ${response.status}`);
    }

    console.log("Mensagem enviada com sucesso:", data);
    return data;
  } catch (err) {
    console.error("Falha no envio WhatsApp:", err);
    throw err;
  }
}

// Webhook de verificação (GET)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verificado com sucesso!");
    return res.status(200).send(challenge);
  } else {
    return res.sendStatus(403);
  }
});

// Receber mensagens do WhatsApp (POST)
app.post("/webhook", async (req, res) => {
  console.log("Mensagem recebida do WhatsApp:", JSON.stringify(req.body, null, 2));

  try {
    const entry = req.body.entry?.[0];
    if (!entry) return res.sendStatus(200);

    const change = entry.changes?.[0];
    if (!change?.value?.messages?.length) {
      // Pode ser status de entrega, etc. – ignore por agora
      return res.sendStatus(200);
    }

    const message = change.value.messages[0];
    const from = message.from; // Número do usuário (ex: 5511999999999)
    const text = message.text?.body;

    if (!text) {
      console.log("Mensagem sem texto (pode ser imagem, reação, etc.)");
      return res.sendStatus(200);
    }

    console.log(`Mensagem de ${from}: ${text}`);

    // Enviar para Gemini API (formato correto)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    // Ou use gemini-1.5-pro se tiver acesso / pago

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: text, // ou personalize: `Responda em português: ${text}`
              },
            ],
            role: "user",
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 300, // ajuste conforme necessário
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errData = await geminiResponse.json();
      console.error("Erro Gemini:", errData);
      throw new Error("Falha na Gemini API");
    }

    const geminiData = await geminiResponse.json();
    const candidates = geminiData.candidates;
    const replyText =
      candidates?.[0]?.content?.parts?.[0]?.text ||
      "Desculpe, não consegui processar sua mensagem no momento.";

    console.log(`Resposta Gemini: ${replyText}`);

    // Enviar resposta de volta pro WhatsApp
    await sendWhatsAppMessage(from, replyText);

    res.sendStatus(200);
  } catch (err) {
    console.error("Erro no webhook:", err);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});