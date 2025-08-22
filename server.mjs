// server.mjs
import express from 'express';
import bodyParser from 'body-parser';
import { setupEmailWebhook, processEmail } from './email_handler.js';
import { createIssue } from './github.mjs';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Email webhook
setupEmailWebhook(app);

// Manual email processing endpoint (for testing)
app.post('/process-email', async (req, res) => {
  try {
    const { from, subject, text, html } = req.body;
    
    if (!from || !subject || (!text && !html)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const emailData = { from, subject, text, html };
    const result = await processEmail(emailData);
    
    // Create GitHub issue
    const issue = await createIssue(result.issueData.title, result.issueData.body, result.issueData.labels);
    
    // Note: Supabase logging removed - using GitHub issues for tracking
    
    res.json({ 
      success: true, 
      ticketId: result.ticketData.id,
      issueNumber: issue.number,
      triage: result.triageResult
    });
  } catch (error) {
    console.error('Error processing email:', error);
    res.status(500).json({ error: 'Failed to process email' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Email webhook server running on port ${PORT}`);
  console.log(`📧 Email webhook: http://localhost:${PORT}/email-webhook`);
  console.log(`🔧 Health check: http://localhost:${PORT}/health`);
});

export default app;
