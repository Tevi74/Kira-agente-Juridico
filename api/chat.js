// api/chat.js
const admin = require("firebase-admin");
const OpenAI = require("openai");

let adminApp;
function getAdmin() {
  if (!adminApp) {
    adminApp = admin.initializeApp({
      credential: admin.credential.cert({
        project_id: process.env.FIREBASE_PROJECT_ID,
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
  }
  return { db: admin.firestore() };
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function ensureThreadId(db, uid) {
  const ref = db.collection("users").doc(uid);
  const snap = await ref.get();
  let data = snap.data() || {};
  if (data.openaiThreadId) return data.openaiThreadId;
  const thread = await client.beta.threads.create();
  await ref.set({ ...data, openaiThreadId: thread.id, updatedAt: Date.now() }, { merge: true });
  return thread.id;
}

async function runAssistant(threadId, assistantId, userMessage) {
  // Adiciona mensagem do usuário
  await client.beta.threads.messages.create(threadId, {
    role: "user",
    content: userMessage,
  });

  // Roda o assistant
  const run = await client.beta.threads.runs.create(threadId, {
    assistant_id: assistantId,
  });

  // Poll até concluir (timeout simples)
  const started = Date.now();
  while (true) {
    const r = await client.beta.threads.runs.retrieve(threadId, run.id);
    if (r.status === "completed") break;
    if (r.status === "failed" || r.status === "cancelled" || r.status === "expired") {
      throw new Error(`Assistant run status: ${r.status}`);
    }
    if (Date.now() - started > 60000) {
      throw new Error("Timeout aguardando a resposta do Assistant");
    }
    await new Promise(res => setTimeout(res, 1000));
  }

  // Lê mensagens (última do assistant)
  const msgs = await client.beta.threads.messages.list(threadId, { order: "desc", limit: 5 });
  const assistantMsg = msgs.data.find(m => m.role === "assistant");
  if (!assistantMsg) return "Sem resposta.";
  // Junta blocos de texto
  let text = "";
  for (const part of assistantMsg.content || []) {
    if (part.type === "text") text += part.text.value;
  }
  return text.trim() || "Sem resposta.";
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const { uid, message } = req.body || {};
    if (!uid || !message) return res.status(400).json({ error: "uid e message são obrigatórios" });

    const assistantId = process.env.OPENAI_ASSISTANT_ID;
    if (!assistantId) return res.status(500).json({ error: "OPENAI_ASSISTANT_ID não configurado" });

    const { db } = getAdmin();
    const threadId = await ensureThreadId(db, uid);

    // Prefixo: saudação institucional (primeira mensagem)
    let userMessage = message;
    const userRef = db.collection("users").doc(uid);
    const snap = await userRef.get();
    const data = snap.data() || {};
    if (!data._kiraGreeted) {
      userMessage =
        "Mensagem inicial do sistema: Responda com uma breve saudação institucional no primeiro retorno, " +
        "incluindo a frase: \"Kira é uma inteligência artificial jurídica de alta performance\".\n\n" +
        `Pergunta do usuário: ${message}`;
      await userRef.set({ ...data, _kiraGreeted: true }, { merge: true });
    }

    const answer = await runAssistant(threadId, assistantId, userMessage);
    res.status(200).json({ answer });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro no chat do Assistant" });
  }
};
