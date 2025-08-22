import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function embedDocs() {
  // Load Firecrawl docs or issues from a text file
  const text = fs.readFileSync("firecrawl_api.txt", "utf8");
  const chunks = text.match(/.{1,500}/gs); // split into ~500 char chunks

  for (const chunk of chunks) {
    const embedding = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: chunk
    });

    await supabase.from("docs").insert({
      content: chunk,
      embedding: embedding.data[0].embedding
    });
  }
  console.log("Docs embedded into Supabase.");
}

embedDocs();
