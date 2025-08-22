import OpenAI from "openai";
import { createIssue } from "./github.js";
import { logTicket, queryDocs } from "./supabase.js";
import dotenv from "dotenv";

dotenv.config();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function callAgent(message, source, user) {
  // Get embedding for RAG
  const embedding = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: message
  });

  const contextDocs = await queryDocs(embedding.data[0].embedding);

  const prompt = `
You are Firecrawl's AI Support Engineer.
- Use the docs below when answering.
- Reply concisely.
- Classify as [bug], [feature request], [how-to], or [other].
- If bug, create GitHub issue.
- Confidence: output 0–1.

Docs:
${contextDocs}

User (${source} - ${user}): ${message}
`;

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "system", content: prompt }]
  });

  const reply = res.choices[0].message.content;

  // Detect bugs
  let category = "other";
  if (reply.toLowerCase().includes("bug")) {
    category = "bug";
    await createIssue("Bug Report", `${message}\n\nFrom: ${user}`);
  }

  // Log ticket
  await logTicket(user, source, message, reply, category, 0.85);
  return reply;
}
