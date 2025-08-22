import dotenv from "dotenv";
dotenv.config();

// Test all required environment variables
const requiredVars = [
  'DISCORD_BOT_TOKEN',
  'DISCORD_CLIENT_ID', 
  'DISCORD_GUILD_ID',
  'OPENAI_API_KEY',
  'GITHUB_TOKEN',
  'GITHUB_OWNER',
  'GITHUB_REPO',
  'MICROSOFT_CLIENT_ID',
  'MICROSOFT_CLIENT_SECRET',
  'MICROSOFT_TENANT_ID',
  'MICROSOFT_USER_ID',
  'FIRECRAWL_API_KEY',
  'FIRECRAWL_DOCS_URL'
];

console.log("🔍 Environment Variables Test\n");

let allGood = true;

for (const varName of requiredVars) {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName} = ${value.substring(0, 20)}...`);
  } else {
    console.log(`❌ ${varName} = MISSING`);
    allGood = false;
  }
}

// Check optional variables
const optionalVars = [
  'SUPABASE_URL',
  'SUPABASE_KEY',
  'MICROSOFT_MULTI_TENANT'
];

console.log("\n📋 Optional Variables:");
for (const varName of optionalVars) {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName} = ${value}`);
  } else {
    console.log(`⚠️  ${varName} = Not set (optional)`);
  }
}

console.log(`\n${allGood ? '🎉 All required variables are set!' : '❌ Some required variables are missing.'}`);

if (allGood) {
  console.log('\n🚀 Ready to start the bot!');
} else {
  console.log('\n📝 Please add the missing variables to your .env file.');
}
