import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

// Initialize GoogleGenAI with proper telemetry headers / lazy instantiation
let aiInstance: GoogleGenAI | null = null;

function getGoogleGenAI(): GoogleGenAI {
  const currentKey = process.env.GEMINI_API_KEY;
  if (!currentKey) {
    throw new Error("GEMINI_API_KEY is not defined in process.env");
  }

  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey: currentKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

app.use(express.json());

// API: Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// API: IA Chat Concierge
app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Mensagens inválidas ou ausentes" });
    }

    let aiClient;
    try {
      aiClient = getGoogleGenAI();
    } catch (e: any) {
      console.warn("GoogleGenAI lazy initialization failed:", e.message);
      return res.status(503).json({
        error: "O Assistente de IA não está ativado no momento. Verifique se a sua chave GEMINI_API_KEY está configurada no painel de Configurações (Secrets) do AI Studio."
      });
    }

    // Format prompt and history for @google/genai SDK
    // @google/genai expects { role: 'user' | 'model', parts: [{ text: '...' }] }
    const formattedContents = messages.map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content || "" }]
    }));

    const systemInstruction = 
      "Você é a Assistente Virtual do Instituto SerClin, uma clínica médica de excelência em saúde integrada e bem-estar.\n" +
      "Seu objetivo é acolher os pacientes de forma empática, profissional, amigável e calorosa (em português do Brasil).\n\n" +
      "Especialidades do Instituto SerClin:\n" +
      "1. Psicologia: Terapia para crianças, adolescentes, adultos, casais e aconselhamento familiar.\n" +
      "2. Psiquiatria: Avaliação médica, diagnóstico, receita e tratamento de transtornos psiquiátricos (depressão, ansiedade, TOC, TDAH, etc.).\n" +
      "3. Nutrição: Planos de reeducação alimentar, emagrecimento, nutrição esportiva e nutrição funcional.\n" +
      "4. Fonoaudiologia: Reabilitação de linguagem, atrasos de fala, oratória, distúrbios vocais e deglutição.\n" +
      "5. Fisioterapia: Reabilitação traumato-ortopédica, pilates clínico, RPG, reabilitação esportiva e controle de dores.\n\n" +
      "Corpo Clínico do Instituto SerClin:\n" +
      "- Dr. Mateus Silva (Psiquiatra): Especialista em transtornos de humor, depression, ansiedade e terapia médica continuada.\n" +
      "- Dra. Laura Mendes (Psicóloga Clínica): Focada em terapia cognitivo-comportamental (TCC), inteligência emocional e autoconhecimento para adultos.\n" +
      "- Dra. Renata Borges (Psicóloga Infantil): Psicoterapeuta infantil e ludoescuta especializada em desenvolvimento infantojuvenil e apoio à família.\n" +
      "- Dra. Carolina Castro (Nutricionista Funcional): Coach de saúde e especialista em reeducação nutricional, bem-estar digestivo e desempenho esportivo.\n" +
      "- Dra. Julia Santos (Fonoaudióloga): Especialista em fala, processamento auditivo, fono estética e reabilitação de voz e disfonia.\n" +
      "- Dr. Henrique Souza (Fisioterapeuta): Especialista em reabilitação física, pilates terapêutico e fortalecimento muscular pós-lesão.\n\n" +
      "Regras de Negócio Importantes:\n" +
      "1. NUNCA forneça diagnósticos conclusivos nem prescreva remédios ou dosagens. Sempre adicione um aviso atencioso de que suas sugestões são informativas e que uma consulta com nossos especialistas humanos é vital.\n" +
      "2. Recomende o especialista correto baseando-se especificamente no relato ou queixa do usuário. Diga explicitamente o nome do profissional (ex: 'Para a sua queixa, recomendo agendar uma avaliação com a Dra. Laura Mendes na nossa especialidade de Psicologia').\n" +
      "3. Caso o paciente pergunte sobre agendamento, indique que ele pode marcar uma sessão facilmente clicando no botão ou indo à aba de 'Agendar Consulta' de forma rápida aqui mesmo no portal.\n" +
      "4. Se o usuário falar sobre planos de saúde aceitos, diga que aceitamos os principais convênios (como Amil, Bradesco Saúde, SulAmérica, Unimed e Porto Seguro) além de atendimentos particulares com emissão de nota fiscal para reembolso.\n" +
      "5. Responda de forma organizada, usando parágrafos espaçados, tópicos simpáticos se necessário, mantendo as mensagens visualmente elegantes e acolhedoras.";

    // Generate content using gemini-3.5-flash (Basic clean tasks + Q&A standard model)
    const response = await aiClient.models.generateContent({
      model: "gemini-3.5-flash",
      contents: formattedContents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const reply = response.text || "Desculpe, não consegui processar seu pedido. Como posso ajudar com suas consultas do Instituto SerClin?";
    res.json({ content: reply });
  } catch (error: any) {
    console.error("Gemini Error:", error);
    res.status(500).json({ 
      error: "Ocorreu um erro no processador de IA do Instituto SerClin.", 
      details: error.message || error 
    });
  }
});

// Setup Vite Dev server or production static build
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Iniciando em modo de DESENVOLVIMENTO com middleware do Vite...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Iniciando em modo de PRODUÇÃO servindo arquivos estáticos de 'dist'...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SerClin Server] Rodando com sucesso em http://localhost:${PORT}`);
  });
}

setupServer();
