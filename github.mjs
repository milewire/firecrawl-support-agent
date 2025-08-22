// github.mjs
import "dotenv/config";
import { Octokit } from "@octokit/rest";

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

export async function createIssue({ title, body, labels = [] }) {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  if (!owner || !repo || !process.env.GITHUB_TOKEN) {
    throw new Error("Missing GITHUB_OWNER/GITHUB_REPO/GITHUB_TOKEN");
  }

  const { data } = await octokit.issues.create({
    owner,
    repo,
    title,
    body,
    labels,
  });
  return data.html_url; // link to the created issue
}
