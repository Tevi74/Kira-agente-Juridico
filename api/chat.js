import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { message, threadId } = req.body;

  try {
    // se não existir thread ainda, cria uma
    const thread = threadId || (await client.beta.threads.create()).id;

    // adiciona a mensagem do usuário
    await client.beta.threads.messages.create(thread, {
      role: "user",
      content: message,
    });

    // roda o assistant
    const run = await client.beta.threads.runs.create(thread, {
      assistant_id: process.env.OPENAI_ASSISTANT_ID,
    });

    // espera a resposta
    let runStatus;
    do {
      runStatus = await client.beta.threads.runs.retrieve(thread, run.id);
      await new Promise(r => setTimeout(r, 1000));
    } while (runStatus.status !== "completed");

    const msgs = await client.beta.threads.messages.list(thread);
    const reply = msgs.data[0].content[0].text.value;

    res.json({ reply, threadId: thread });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
