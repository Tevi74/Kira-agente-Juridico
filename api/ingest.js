// api/ingest.js
const admin = require("firebase-admin");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const path = require("path");

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

async function bufferFromGCS(bucket, storagePath) {
  const file = bucket.file(storagePath);
  const [exists] = await file.exists();
  if (!exists) throw new Error("Arquivo não encontrado no Storage: " + storagePath);
  const [buf] = await file.download();
  return buf;
}

async function extractText({ buffer, filename, mime }) {
  const ext = (path.extname(filename || "").toLowerCase() || "").replace(".", "");

  // Limite de tamanho p/ V1
  const maxBytes = 10 * 1024 * 1024; // 10 MB
  if (buffer.length > maxBytes) {
    return `Arquivo maior que 10MB — extração parcial não realizada nesta versão.`;
  }

  if (ext === "pdf" || mime === "application/pdf") {
    const data = await pdfParse(buffer);
    return (data.text || "").trim();
  }

  if (ext === "docx" || mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const result = await mammoth.extractRawText({ buffer });
    return (result.value || "").trim();
  }

  // Para imagens e outros formatos, registrar que não há extração (V2: plugar OCR)
  if (["png", "jpg", "jpeg"].includes(ext) || mime?.startsWith("image/")) {
    return `Imagem recebida (${filename}). (V2: OCR)`;
  }

  return `Formato não suportado para extração nesta versão (${filename}).`;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const { uid, storagePath, filename, mime } = req.body || {};
    if (!uid || !storagePath || !filename) {
      res.status(400).json({ error: "uid, storagePath e filename são obrigatórios" });
      return;
    }

    const { db, bucket } = getAdmin();

    const buffer = await bufferFromGCS(bucket, storagePath);
    let text = await extractText({ buffer, filename, mime });

    // Limita tamanho do texto salvo (evita exceder limites do Firestore e do chat)
    const maxChars = parseInt(process.env.KIRA_MAX_DOC_CHARS || "60000", 10);
    if (text.length > maxChars) text = text.slice(0, maxChars);

    // Tenta achar o doc de upload correspondente (pelo trio uid+storagePath+filename)
    const q = await db.collection("uploads")
      .where("uid", "==", uid)
      .where("storagePath", "==", storagePath)
      .where("filename", "==", filename)
      .limit(1)
      .get();

    let docRef;
    if (!q.empty) {
      docRef = q.docs[0].ref;
      await docRef.update({ textExtract: text, updatedAt: Date.now(), status: "ready" });
    } else {
      docRef = await db.collection("uploads").add({
        uid, filename, storagePath, size: buffer.length, mime,
        status: "ready",
        textExtract: text,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }

    res.status(200).json({ ok: true, id: docRef.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro na ingestão do documento" });
  }
};
