// email_handler.js
import { Client } from '@microsoft/microsoft-graph-client';
import { ConfidentialClientApplication } from '@azure/msal-node';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

// Microsoft Graph setup - Flexible for single/multi-tenant
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

// Get Graph client with access token
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

// Microsoft Graph Webhook Subscription Management
export async function createEmailSubscription() {
  try {
    const graphClient = await getGraphClient();
    
    // Get the user's email address first
    const user = await graphClient.api('/users/' + process.env.MICROSOFT_USER_ID).get();
    console.log('👤 User email:', user.mail || user.userPrincipalName);
    
    const subscription = {
      changeType: 'created',
      notificationUrl: 'https://firecrawl-support-agent.onrender.com/email-webhook',
      resource: '/users/' + process.env.MICROSOFT_USER_ID + '/messages',
      expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days
      clientState: 'firecrawl-support-agent',
      includeResourceData: false
    };

    console.log('📧 Creating subscription with:', JSON.stringify(subscription, null, 2));
    
    const result = await graphClient.api('/subscriptions').post(subscription);
    console.log('✅ Email subscription created:', result.id);
    return result;
  } catch (error) {
    console.error('❌ Error creating email subscription:', error);
    if (error.body) {
      console.error('❌ Error details:', error.body);
    }
    throw error;
  }
}

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

export async function deleteSubscription(subscriptionId) {
  try {
    const graphClient = await getGraphClient();
    await graphClient.api(`/subscriptions/${subscriptionId}`).delete();
    console.log('✅ Subscription deleted:', subscriptionId);
  } catch (error) {
    console.error('❌ Error deleting subscription:', error);
    throw error;
  }
}

// Firecrawl docs cache
let firecrawlDocs = null;
let lastDocsUpdate = 0;
const DOCS_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

async function fetchFirecrawlDocs() {
  if (firecrawlDocs && (Date.now() - lastDocsUpdate) < DOCS_CACHE_DURATION) {
    return firecrawlDocs;
  }

  // Use a fallback URL if the main one fails
  const docsUrl = process.env.FIRECRAWL_DOCS_URL || 'https://docs.firecrawl.dev';
  
  try {
    // Try to fetch from the configured URL first
    if (process.env.FIRECRAWL_DOCS_URL && process.env.FIRECRAWL_API_KEY) {
      const response = await fetch(process.env.FIRECRAWL_DOCS_URL, {
        headers: {
          'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const docs = await response.json();
        firecrawlDocs = docs;
        lastDocsUpdate = Date.now();
        return docs;
      }
    }
    
    // Fallback: return basic Firecrawl info
    const fallbackDocs = {
      name: "Firecrawl",
      description: "Web scraping API for LLM-ready data",
      endpoints: ["/scrape", "/sitemap", "/search"],
      rateLimit: "1000 requests/hour",
      commonIssues: ["rate limits", "invalid URLs", "API errors", "billing"]
    };
    
    firecrawlDocs = fallbackDocs;
    lastDocsUpdate = Date.now();
    return fallbackDocs;
  } catch (error) {
    console.error('Error fetching Firecrawl docs:', error);
    // Return fallback docs even on error
    const fallbackDocs = {
      name: "Firecrawl",
      description: "Web scraping API for LLM-ready data",
      endpoints: ["/scrape", "/sitemap", "/search"],
      rateLimit: "1000 requests/hour",
      commonIssues: ["rate limits", "invalid URLs", "API errors", "billing"]
    };
    return fallbackDocs;
  }
}

export async function processEmail(emailData) {
  const { from, subject, text, html } = emailData;
  
  // Extract user info
  const userEmail = from.email || from;
  const userName = from.name || userEmail.split('@')[0];
  
  // Create ticket data
  const ticketData = {
    user: userName,
    source: 'email',
    message: text || html,
    subject: subject,
    email: userEmail
  };

  // Analyze with AI for triage
  const triageResult = await triageEmail(ticketData);
  
  // Create GitHub issue
  const issueData = {
    title: `[Email] ${subject}`,
    body: formatEmailBody(ticketData, triageResult),
    labels: triageResult.labels
  };

  return { ticketData, triageResult, issueData };
}

async function triageEmail(ticketData) {
  const docs = await fetchFirecrawlDocs();
  
  const prompt = `
You are a Firecrawl support expert. Analyze this email and categorize it:

Email: ${ticketData.message}

Firecrawl is a web scraping API with these key features:
- Endpoints: /scrape, /sitemap, /search
- Rate limit: 1000 requests/hour
- Common issues: rate limits, invalid URLs, API errors, billing

Categorize this email as one of:
- api_error: API/Scraping issues
- rate_limit: Rate limiting problems
- billing: Subscription/payment issues
- integration: SDK/API integration help
- question: General questions
- other: Doesn't fit other categories

Severity levels: low, medium, high, critical

Respond with ONLY valid JSON (no markdown, no code blocks):
{
  "category": "category_name",
  "severity": "severity_level",
  "labels": ["type/category", "severity/level"],
  "summary": "Brief summary of the issue",
  "needsHuman": true/false
}
`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.1
      })
    });

    const data = await response.json();
    let content = data.choices[0].message.content;
    
    // Clean up the response - remove markdown formatting if present
    content = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
    
    try {
      const result = JSON.parse(content);
      return result;
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', content);
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error('Failed to parse extracted JSON:', e);
        }
      }
      
      // Return fallback result
      return {
        category: 'other',
        severity: 'medium',
        labels: ['type/other', 'severity/medium'],
        summary: 'Unable to categorize',
        needsHuman: true
      };
    }
  } catch (error) {
    console.error('Error triaging email:', error);
    return {
      category: 'other',
      severity: 'medium',
      labels: ['type/other', 'severity/medium'],
      summary: 'Unable to categorize',
      needsHuman: true
    };
  }
}

function formatEmailBody(ticketData, triageResult) {
  return `
## Email Support Request

**From:** ${ticketData.email}
**Subject:** ${ticketData.subject}
**Category:** ${triageResult.category}
**Severity:** ${triageResult.severity}
**Summary:** ${triageResult.summary}

### Message:
${ticketData.message}

---
*Auto-triaged by AI Support Agent*
  `.trim();
}

export async function sendEmailReply(to, subject, content) {
  try {
    const graphClient = await getGraphClient();
    
    const message = {
      subject: `Re: ${subject}`,
      body: {
        contentType: 'HTML',
        content: content.replace(/\n/g, '<br>')
      },
      toRecipients: [
        {
          emailAddress: {
            address: to
          }
        }
      ]
    };

    await graphClient.api('/users/' + process.env.MICROSOFT_USER_ID + '/sendMail')
      .post({
        message: message,
        saveToSentItems: true
      });

    console.log(`Email reply sent to ${to}`);
    return true;
  } catch (error) {
    console.error('Error sending email reply:', error);
    return false;
  }
}

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
      
      // Handle subscription lifecycle notifications
      if (req.body.value && req.body.value.length > 0) {
        for (const notification of req.body.value) {
          if (notification.resourceData) {
            // This is a new email notification
            console.log('📧 Processing new email notification');
            
            // Fetch the actual email content
            const graphClient = await getGraphClient();
            const email = await graphClient.api(notification.resource).get();
            
            // Process the email
            const emailData = {
              from: email.from.emailAddress,
              subject: email.subject,
              text: email.body.content,
              html: email.body.content
            };
            
            const result = await processEmail(emailData);
            
            // Create GitHub issue
            const { createIssue } = await import('./github.mjs');
            const issueUrl = await createIssue({
              title: result.issueData.title,
              body: result.issueData.body,
              labels: result.issueData.labels
            });
            
            // Send auto-reply
            const autoReply = generateAutoReply(result.triageResult);
            await sendEmailReply(emailData.from.address, emailData.subject, autoReply);
            
            console.log('✅ Email processed successfully:', issueUrl);
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

export function generateAutoReply(triageResult) {
  const replies = {
    api_error: `Thank you for contacting Firecrawl support. We've received your API issue and our team will investigate shortly. We'll update you within 2 hours.`,
    rate_limit: `Thank you for your message. We understand you're experiencing rate limiting issues. Our team will review your account and get back to you soon.`,
    billing: `Thank you for your billing inquiry. We've received your request and will respond within 1 business day.`,
    integration: `Thank you for your integration question. Our technical team will review your request and provide detailed guidance.`,
    question: `Thank you for your question about Firecrawl. We'll get back to you with a comprehensive answer shortly.`,
    other: `Thank you for contacting Firecrawl support. We've received your message and will respond as soon as possible.`
  };

  return replies[triageResult.category] || replies.other;
}
