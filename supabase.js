import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export async function logTicket(user, source, message, reply, category, confidence) {
  await supabase.from("tickets").insert([
    { user, source, message, reply, category, confidence }
  ]);
}

export async function queryDocs(queryEmbedding) {
  const { data } = await supabase.rpc("match_docs", {
    query_embedding: queryEmbedding,
    match_count: 5
  });
  return data.map(d => d.content).join("\n");
}
