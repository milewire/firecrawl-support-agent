// test-email.mjs
// Using built-in fetch (Node.js 18+)

const RENDER_URL = process.env.RENDER_URL || 'https://YOUR-ACTUAL-RENDER-URL.onrender.com';

async function testEmailProcessing() {
  const testEmail = {
    from: {
      email: 'test@example.com',
      name: 'Test User'
    },
    subject: 'Test Support Request - API Error',
    text: 'I\'m getting a 429 rate limit error when trying to scrape more than 1000 URLs per hour. Can you help me understand the limits?',
    html: '<p>I\'m getting a 429 rate limit error when trying to scrape more than 1000 URLs per hour. Can you help me understand the limits?</p>'
  };

  try {
    console.log('🧪 Testing email processing...');
    console.log(`📧 Sending test email to: ${RENDER_URL}/process-email`);
    
    const response = await fetch(`${RENDER_URL}/process-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testEmail)
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Email processing successful!');
      console.log('📊 Results:', JSON.stringify(result, null, 2));
    } else {
      console.log('❌ Email processing failed:', result);
    }
  } catch (error) {
    console.error('❌ Error testing email:', error.message);
  }
}

testEmailProcessing();
