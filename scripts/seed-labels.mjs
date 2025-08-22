// scripts/seed-labels.mjs
import "dotenv/config";
import { Octokit } from "@octokit/rest";

const token = process.env.GITHUB_TOKEN;
const owner = process.env.GITHUB_OWNER;
const repo  = process.env.GITHUB_REPO;

if (!token || !owner || !repo) {
  console.error("❌ Missing env. Set GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO in .env");
  process.exit(1);
}

const octokit = new Octokit({ auth: token });

// Labels your bot uses
const labels = [
  // Type
  { name: "type/bug",             color: "d73a4a", description: "A defect or error" },
  { name: "type/usage",           color: "0075ca", description: "How-to / usage question" },
  { name: "type/feature_request", color: "a2eeef", description: "New capability or enhancement" },
  { name: "type/billing",         color: "fbca04", description: "Billing / payments" },
  { name: "type/question",        color: "d4c5f9", description: "General question" },
  { name: "type/other",           color: "ededed", description: "Doesn't fit other categories" },

  // Severity
  { name: "severity/low",       color: "c2e0c6", description: "Minor impact" },
  { name: "severity/medium",    color: "fef2c0", description: "Moderate impact" },
  { name: "severity/high",      color: "f9d0c4", description: "High impact" },
  { name: "severity/critical",  color: "b60205", description: "Critical impact / outage" },

  // Meta
  { name: "ai-triaged",       color: "5319e7", description: "Auto-triaged by AI" },
  { name: "triage/conflict",  color: "e99695", description: "User vs AI triage mismatch" },
];

async function upsertLabel(l) {
  try {
    await octokit.issues.getLabel({ owner, repo, name: l.name });
    await octokit.issues.updateLabel({
      owner, repo, name: l.name, color: l.color, description: l.description ?? ""
    });
    console.log("🔄 updated:", l.name);
  } catch (err) {
    if (err?.status === 404) {
      await octokit.issues.createLabel({
        owner, repo, name: l.name, color: l.color, description: l.description ?? ""
      });
      console.log("✅ created:", l.name);
    } else {
      console.error("❌ failed:", l.name, "-", err?.response?.data?.message || err.message);
    }
  }
}

(async () => {
  console.log(`Seeding labels for ${owner}/${repo} …`);
  for (const l of labels) {
    // sequential to avoid abuse detection
    // eslint-disable-next-line no-await-in-loop
    await upsertLabel(l);
  }
  console.log("🎉 Labels ready.");
})();
