// email_poller.js
// Autonomous email polling system for Firecrawl Support Agent

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
const MAX_PROCESSED_EMAILS = 1000; // Keep last 1000 emails in memory

// Email polling function
async function pollForNewEmails() {
  try {
    console.log('📧 Polling for new emails...');
    
    const graphClient = await getGraphClient();
    
    // Get recent emails (last 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const formattedDate = tenMinutesAgo.toISOString().replace(/\.\d{3}Z$/, 'Z');
    
    const emails = await graphClient.api(`/users/${process.env.MICROSOFT_USER_ID}/messages`)
      .filter(`receivedDateTime ge ${formattedDate}`)
      .orderby('receivedDateTime desc')
      .top(10)
      .get();
    
    console.log(`📧 Found ${emails.value.length} recent emails`);
    
    for (const email of emails.value) {
      const emailId = email.id;
      
      // Skip if already processed
      if (processedEmails.has(emailId)) {
        continue;
      }
      
      // Skip emails from self (replies)
      if (email.from?.emailAddress?.address === process.env.MICROSOFT_USER_ID) {
        continue;
      }
      
      console.log(`📧 Processing new email: ${email.subject} from ${email.from?.emailAddress?.address}`);
      
      try {
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
        await sendEmailReply(emailData.from.address, emailData.subject, autoReply);
        
        // Mark as processed
        processedEmails.add(emailId);
        
        console.log(`✅ Email processed successfully: ${issueUrl}`);
        
      } catch (error) {
        console.error(`❌ Error processing email ${emailId}:`, error);
      }
    }
    
    // Clean up old processed emails (keep memory usage low)
    if (processedEmails.size > MAX_PROCESSED_EMAILS) {
      const emailsArray = Array.from(processedEmails);
      processedEmails = new Set(emailsArray.slice(-MAX_PROCESSED_EMAILS / 2));
    }
    
  } catch (error) {
    console.error('❌ Error polling for emails:', error);
  }
}

// Start email polling
let pollInterval;

export function startEmailPolling(intervalMinutes = 2) {
  console.log(`🚀 Starting email polling every ${intervalMinutes} minutes...`);
  
  // Poll immediately
  pollForNewEmails();
  
  // Set up recurring polling
  pollInterval = setInterval(pollForNewEmails, intervalMinutes * 60 * 1000);
  
  console.log('✅ Email polling started successfully');
}

export function stopEmailPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    console.log('🛑 Email polling stopped');
  }
}

// Export for testing
export { pollForNewEmails };
