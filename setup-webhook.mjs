// setup-webhook.mjs
// Set up Microsoft Graph webhook subscription for automatic email processing

import "dotenv/config";
import { createEmailSubscription, listSubscriptions, deleteSubscription } from './email_handler.js';

async function setupWebhook() {
  try {
    console.log('🔧 Setting up Microsoft Graph webhook subscription...');
    
    // Check if we have the required environment variables
    if (!process.env.MICROSOFT_CLIENT_ID || !process.env.MICROSOFT_CLIENT_SECRET || !process.env.MICROSOFT_USER_ID) {
      console.error('❌ Missing required environment variables:');
      console.error('   - MICROSOFT_CLIENT_ID');
      console.error('   - MICROSOFT_CLIENT_SECRET');
      console.error('   - MICROSOFT_USER_ID');
      process.exit(1);
    }

    // List existing subscriptions
    console.log('📋 Checking existing subscriptions...');
    const existingSubs = await listSubscriptions();
    
    if (existingSubs.length > 0) {
      console.log('🗑️  Found existing subscriptions, cleaning up...');
      for (const sub of existingSubs) {
        if (sub.clientState === 'firecrawl-support-agent') {
          await deleteSubscription(sub.id);
        }
      }
    }

    // Create new subscription
    console.log('✅ Creating new email subscription...');
    const subscription = await createEmailSubscription();
    
    console.log('🎉 Webhook subscription created successfully!');
    console.log('📧 Subscription ID:', subscription.id);
    console.log('⏰ Expires:', subscription.expirationDateTime);
    console.log('🔗 Webhook URL:', subscription.notificationUrl);
    
    console.log('\n📝 Next steps:');
    console.log('1. Send an email to your Microsoft account');
    console.log('2. Check the bot logs for webhook notifications');
    console.log('3. Verify auto-reply and GitHub issue creation');
    
  } catch (error) {
    console.error('❌ Error setting up webhook:', error);
    process.exit(1);
  }
}

setupWebhook();
