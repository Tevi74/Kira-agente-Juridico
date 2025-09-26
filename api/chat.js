// api/chat.js
const { Configuration, OpenAIApi } = require("openai");
const admin = require("firebase-admin");

let adminApp;
function getAdmin() {
  if (!adminApp) {
    adminApp = admin.initializeApp({
      credential: admin.credential.cert({
        project_id: process.env.FIREBASE_PROJECT_ID,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
      }),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
  }
  return {
    db: admin.firestore(),
    bucket: admin.storage().bucket()
  };
}

const openai = new OpenAIApi(new Configuration({
  apiKey: process.env.OPENAI_API_KEY
}));

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const { uid, message } = req.body || {};
    if (!uid || !message) {
      res.status(400).json({ error: "uid e message são obrigatórios" });
      return;
    }

    const { db } = getAdmin();

    // Carrega docs do usuário (metadados + texto extraído)
    const maxDocs = parseInt(process.env.KIRA_MAX_DOCS || "10", 10);
    const uploadsSnap = await db.collection("uploads")
      .where("uid", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(maxDocs)
      .get();

    let contextBlocks = [];
    uploadsSnap.forEach(doc => {
      const d = doc.data() || {};
      if (d.textExtract && d.filename) {
        contextBlocks.push(`Arquivo: ${d.filename}\n${d.textExtract}`);
      }
    });
    const context = contextBlocks.join("\n\n---\n\n").slice(0, 200000); // limite de contexto total

    const systemPrompt =
      "Você é a Kira, uma inteligência jurídica de apoio. Observe as diretrizes: " +
      "1) Você não substitui o(a) advogado(a) responsável. " +
      "2) Mantenha linguagem clara, objetiva e profissional. " +
      "3) Quando aplicável, cite fundamentos legais brasileiros (CPC, CP, CF/88, CDC, CLT etc.) de forma verificável, sem inventar. " +
      "4) Se não tiver certeza, diga o que falta e peça o dado. " +
      "5) Jamais capte clientela; foque em orientação técnica. " +
      "6) Se mencionar prazos, destaque que é orientação e que o(a) advogado(a) deve confirmar no caso concreto.";

    const userContent = [
      context
        ? `Contexto de documentos do usuário (resumo extraído):\n\n${context}`
        : "Sem documentos indexados no momento.",
      `Pergunta do usuário:\n${message}`
    ].join("\n\n");

    const completion = await openai.createChatCompletion({
      model: "gpt-4o-mini", // use um modelo disponível na sua conta
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent }
      ]
    });

    const answer = completion.data.choices?.[0]?.message?.content?.trim() || "Sem resposta.";
    res.status(200).json({ answer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno no chat" });
  }
};
