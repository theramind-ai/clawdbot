import express from "express";
import fetch from "node-fetch"; // npm install node-fetch@3
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Webhook de verificação
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verificado");
    return res.status(200).send(challenge);
  } else {
    return res.sendStatus(403);
  }
});

// Receber mensagens do WhatsApp
app.post("/webhook", async (req, res) => {
  console.log("Mensagem recebida:", JSON.stringify(req.body, null, 2));

  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!messages || messages.length === 0) {
      return res.sendStatus(200); // nada pra processar
    }

    for (const message of messages) {
      const from = message.from;
      const text = message.text?.body;

      if (!text) continue;

      console.log(`Mensagem de ${from}: ${text}`);

      // 🔥 Enviar para Gemini
      const geminiResponse = await fetch("https://gemini.googleapis.com/v1/your-endpoint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GEMINI_API_KEY}`
        },
        body: JSON.stringify({
          prompt: text,
          max_output_tokens: 100
        })
      });

      const geminiData = await geminiResponse.json();
      const replyText = geminiData?.output_text || "Não consegui entender sua mensagem.";

      // 🔥 Aqui você enviaria a resposta de volta para o WhatsApp
      console.log(`Resposta para ${from}: ${replyText}`);
      // use fetch para chamar a API do WhatsApp Business e enviar a mensagem
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("Erro processando mensagem:", err);
    res.sendStatus(500);
  }
});

// 🔥 Porta do Render ou fallback
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});