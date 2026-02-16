import express from "express";
import axios from "axios";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();
app.use(express.json());

const VERIFY_TOKEN = "claw_verify_123";

// 🔐 Meta
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// 🔐 Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function getAIResponse(userMessage) {
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
  });

  const prompt = `
Você é um assistente inteligente que responde no WhatsApp.
Responda de forma clara, objetiva e amigável.
Mensagem do usuário: ${userMessage}
`;

  const result = await model.generateContent(prompt);
  const response = await result.response;

  return response.text();
}

async function sendMessage(to, message) {
  await axios.post(
    `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to: to,
      text: { body: message },
    },
    {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );
}

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

app.post("/webhook", async (req, res) => {
  try {
    const message =
      req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (message?.text?.body) {
      const userMessage = message.text.body;
      const from = message.from;

      console.log("Mensagem recebida:", userMessage);

      const aiReply = await getAIResponse(userMessage);

      await sendMessage(from, aiReply);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("Erro:", error.response?.data || error.message);
    res.sendStatus(500);
  }
});

// 🔥 ESSA PARTE É CRÍTICA NO RENDER
const PORT = process.env.PORT;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});