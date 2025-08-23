// webhook_email_handler.js
// Webhook-based email processing for Firecrawl Support Agent

import { Client } from '@microsoft/microsoft-graph-client';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { processEmail, generateAutoReply, sendEmailReply } from './email_handler.js';
import { createIssue } from './github.mjs';
import dotenv from 'dotenv';

dotenv.config();

// Microsoft Graph setup
const getAuthority = () => {
  if (process.env.MICROSOFT_MULTI_TENANT === 'true') {
    return 'https://login.microsoftonline.com/common';
  }
  return `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}`;
};

const msalConfig = {
  auth: {
    clientId: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    authority: getAuthority()
  }
};

const msalClient = new ConfidentialClientApplication(msalConfig);

async function getGraphClient() {
  const authResult = await msalClient.acquireTokenByClientCredential({
    scopes: ['https://graph.microsoft.com/.default']
  });
  
  return Client.init({
    authProvider: (done) => {
      done(null, authResult.accessToken);
    }
  });
}

// Track processed emails to avoid duplicates
let processedEmails = new Set();
const MAX_PROCESSED_EMAILS = 1000;

// Webhook email processing function
export async function processWebhookEmail(emailId) {
  try {
    console.log(`📧 Processing webhook email: ${emailId}`);
    
    const graphClient = await getGraphClient();
    
    // Get the specific email
    const email = await graphClient.api(`/users/${process.env.MICROSOFT_USER_ID}/messages/${emailId}`).get();
    
    // Skip if already processed
    if (processedEmails.has(emailId)) {
      console.log(`📧 Email ${emailId} already processed, skipping`);
      return;
    }
    
    // Skip emails from self
    if (email.from?.emailAddress?.address === process.env.MICROSOFT_USER_ID) {
      console.log(`📧 Skipping email from self: ${email.from?.emailAddress?.address}`);
      return;
    }
    
    // Skip auto-replies
    if (email.subject && email.subject.toLowerCase().startsWith('re:')) {
      console.log(`📧 Skipping auto-reply email: ${email.subject}`);
      return;
    }
    
    // Skip system notifications
    const subject = email.subject?.toLowerCase() || '';
    const fromAddress = email.from?.emailAddress?.address?.toLowerCase() || '';
    
    if (subject.includes('auto-reply') || 
        subject.includes('out of office') || 
        subject.includes('vacation') ||
        subject.includes('delivery status') ||
        subject.includes('read receipt') ||
        fromAddress.includes('noreply') ||
        fromAddress.includes('no-reply') ||
        fromAddress.includes('donotreply')) {
      console.log(`📧 Skipping system email: ${email.subject}`);
      return;
    }
    
    console.log(`📧 Processing new email: ${email.subject} from ${email.from?.emailAddress?.address}`);
    
    // Process the email
    const emailData = {
      from: email.from.emailAddress,
      subject: email.subject,
      text: email.body.content,
      html: email.body.content
    };
    
    const result = await processEmail(emailData);
    
    // Create GitHub issue
    const issueUrl = await createIssue({
      title: result.issueData.title,
      body: result.issueData.body,
      labels: result.issueData.labels
    });
    
    // Send auto-reply
    const autoReply = generateAutoReply(result.triageResult);
    const replyToAddress = emailData.from.address;
    
    console.log(`📧 Sending auto-reply to: ${replyToAddress}`);
    await sendEmailReply(replyToAddress, emailData.subject, autoReply);
    
    // Mark as processed
    processedEmails.add(emailId);
    
    console.log(`✅ Email processed successfully: ${issueUrl}`);
    
    // Clean up old processed emails
    if (processedEmails.size > MAX_PROCESSED_EMAILS) {
      const emailsArray = Array.from(processedEmails);
      processedEmails = new Set(emailsArray.slice(-MAX_PROCESSED_EMAILS / 2));
    }
    
  } catch (error) {
    console.error(`❌ Error processing webhook email ${emailId}:`, error);
  }
}

// Webhook setup function
export async function setupEmailWebhook(app) {
  // Microsoft Graph webhook validation endpoint
  app.get('/email-webhook', (req, res) => {
    const validationToken = req.query.validationToken;
    if (validationToken) {
      console.log('✅ Microsoft Graph webhook validation:', validationToken);
      res.set('Content-Type', 'text/plain');
      res.send(validationToken);
    } else {
      res.status(400).json({ error: 'Missing validation token' });
    }
  });

  // Microsoft Graph webhook notification endpoint
  app.post('/email-webhook', async (req, res) => {
    try {
      console.log('📧 Received Microsoft Graph webhook notification');
      
      if (req.body.value && req.body.value.length > 0) {
        for (const notification of req.body.value) {
          if (notification.resourceData) {
            // Extract email ID from the resource URL
            const resourceUrl = notification.resource;
            const emailId = resourceUrl.split('/').pop();
            
            if (emailId) {
              console.log(`📧 Processing webhook for email: ${emailId}`);
              await processWebhookEmail(emailId);
            }
          }
        }
      }
      
      res.status(202).send(); // Microsoft expects 202 for webhook notifications
    } catch (error) {
      console.error('❌ Email webhook error:', error);
      res.status(500).json({ error: 'Failed to process email' });
    }
  });
}

// Create webhook subscription
export async function createEmailSubscription() {
  try {
    const graphClient = await getGraphClient();
    
    const subscription = {
      changeType: 'created',
      notificationUrl: 'https://firecrawl-support-agent.onrender.com/email-webhook',
      resource: '/users/' + process.env.MICROSOFT_USER_ID + '/messages',
      expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days
      clientState: 'firecrawl-support-agent',
      includeResourceData: false
    };

    console.log('📧 Creating webhook subscription...');
    const result = await graphClient.api('/subscriptions').post(subscription);
    console.log('✅ Email webhook subscription created:', result.id);
    return result;
  } catch (error) {
    console.error('❌ Error creating webhook subscription:', error);
    throw error;
  }
}

// List webhook subscriptions
export async function listSubscriptions() {
  try {
    const graphClient = await getGraphClient();
    const result = await graphClient.api('/subscriptions').get();
    return result.value;
  } catch (error) {
    console.error('❌ Error listing subscriptions:', error);
    throw error;
  }
}

// Delete webhook subscription
export async function deleteSubscription(subscriptionId) {
  try {
    const graphClient = await getGraphClient();
    await graphClient.api(`/subscriptions/${subscriptionId}`).delete();
    console.log('✅ Webhook subscription deleted:', subscriptionId);
  } catch (error) {
    console.error('❌ Error deleting subscription:', error);
    throw error;
  }
}
