// pylon_integration.js
// Pylon integration for workflow orchestration
// This module handles intelligent routing and workflow automation
// OPTIONAL: Only works if PYLON_API_KEY is configured

import fetch from 'node-fetch';

class PylonIntegration {
  constructor() {
    this.baseUrl = process.env.PYLON_API_URL || 'https://api.pylon.com';
    this.apiKey = process.env.PYLON_API_KEY;
    this.enabled = !!this.apiKey; // Only enable if API key is provided
    
    if (!this.enabled) {
      console.log('⚠️ Pylon integration disabled - PYLON_API_KEY not configured');
    }
    
    this.workflows = {
      'api_error': 'firecrawl-api-error-workflow',
      'rate_limit': 'firecrawl-rate-limit-workflow', 
      'billing': 'firecrawl-billing-workflow',
      'integration': 'firecrawl-integration-workflow',
      'question': 'firecrawl-question-workflow',
      'other': 'firecrawl-general-workflow'
    };
  }

  // Route ticket to appropriate workflow based on category
  async routeTicket(ticketData) {
    if (!this.enabled) {
      console.log('🔄 Pylon routing skipped - integration not configured');
      return { 
        success: true, 
        skipped: true, 
        reason: 'pylon_not_configured',
        message: 'Pylon integration not configured - using fallback processing'
      };
    }

    try {
      const category = ticketData.triageResult?.category || 'other';
      const workflowId = this.workflows[category];
      
      if (!workflowId) {
        console.log('⚠️ No workflow found for category:', category);
        return { success: false, error: 'No workflow configured' };
      }

      const workflowData = {
        ticketId: ticketData.issueData?.url || 'unknown',
        category: category,
        severity: ticketData.triageResult?.severity || 'medium',
        userEmail: ticketData.ticketData?.email || 'unknown',
        subject: ticketData.ticketData?.subject || 'Support Request',
        message: ticketData.ticketData?.message || '',
        source: ticketData.ticketData?.source || 'unknown',
        needsHuman: ticketData.triageResult?.needsHuman || false,
        timestamp: new Date().toISOString()
      };

      console.log('🔄 Routing ticket to Pylon workflow:', workflowId);
      
      // Send to Pylon workflow
      const response = await fetch(`${this.baseUrl}/workflows/${workflowId}/trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(workflowData)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Ticket routed to Pylon workflow:', result.workflowRunId);
        return { 
          success: true, 
          workflowRunId: result.workflowRunId,
          nextSteps: result.nextSteps || []
        };
      } else {
        console.error('❌ Failed to route to Pylon:', response.status);
        return { success: false, error: 'Pylon routing failed' };
      }

    } catch (error) {
      console.error('❌ Pylon routing error:', error);
      return { success: false, error: error.message };
    }
  }

  // Get workflow status
  async getWorkflowStatus(workflowRunId) {
    if (!this.enabled) {
      return { status: 'not_configured', message: 'Pylon integration not enabled' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/workflows/runs/${workflowRunId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (response.ok) {
        return await response.json();
      } else {
        console.error('❌ Failed to get workflow status:', response.status);
        return null;
      }
    } catch (error) {
      console.error('❌ Error getting workflow status:', error);
      return null;
    }
  }

  // Execute automated response workflow
  async executeAutomatedResponse(ticketData) {
    if (!this.enabled) {
      console.log('🤖 Pylon automated response skipped - using built-in auto-reply');
      return { 
        success: true, 
        automated: true, 
        skipped: true, 
        reason: 'pylon_not_configured',
        message: 'Using built-in auto-reply system'
      };
    }

    try {
      const category = ticketData.triageResult?.category || 'other';
      const severity = ticketData.triageResult?.severity || 'medium';
      
      // Determine if automated response is appropriate
      if (severity === 'critical' || ticketData.triageResult?.needsHuman) {
        console.log('🚨 Critical ticket or needs human - skipping automated response');
        return { success: true, automated: false, reason: 'needs_human' };
      }

      // Execute automated response workflow
      const response = await fetch(`${this.baseUrl}/workflows/firecrawl-auto-response/trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          ticketData: ticketData,
          category: category,
          severity: severity
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Automated response executed:', result.responseId);
        return { 
          success: true, 
          automated: true, 
          responseId: result.responseId 
        };
      } else {
        console.error('❌ Automated response failed:', response.status);
        return { success: false, error: 'Automated response failed' };
      }

    } catch (error) {
      console.error('❌ Automated response error:', error);
      return { success: false, error: error.message };
    }
  }

  // Analyze ticket patterns for insights
  async analyzePatterns(tickets) {
    if (!this.enabled) {
      console.log('📊 Pylon pattern analysis skipped - integration not configured');
      return {
        insights: ['Pylon integration not configured - using basic analytics'],
        totalTickets: tickets.length,
        categories: this.getBasicAnalytics(tickets)
      };
    }

    try {
      const analysisData = {
        totalTickets: tickets.length,
        categories: {},
        severity: {},
        responseTimes: [],
        commonIssues: []
      };

      tickets.forEach(ticket => {
        const category = ticket.category || 'other';
        const severity = ticket.severity || 'medium';
        
        analysisData.categories[category] = (analysisData.categories[category] || 0) + 1;
        analysisData.severity[severity] = (analysisData.severity[severity] || 0) + 1;
      });

      // Send analysis to Pylon for insights
      const response = await fetch(`${this.baseUrl}/analytics/patterns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(analysisData)
      });

      if (response.ok) {
        const insights = await response.json();
        console.log('📊 Pattern analysis completed:', insights.insights);
        return insights;
      } else {
        console.error('❌ Pattern analysis failed:', response.status);
        return null;
      }

    } catch (error) {
      console.error('❌ Pattern analysis error:', error);
      return null;
    }
  }

  // Basic analytics fallback when Pylon is not configured
  getBasicAnalytics(tickets) {
    const categories = {};
    tickets.forEach(ticket => {
      const category = ticket.category || 'other';
      categories[category] = (categories[category] || 0) + 1;
    });
    return categories;
  }

  // Check if Pylon is properly configured
  isConfigured() {
    return this.enabled;
  }

  // Get configuration status
  getStatus() {
    return {
      enabled: this.enabled,
      configured: !!this.apiKey,
      baseUrl: this.baseUrl,
      workflows: Object.keys(this.workflows)
    };
  }
}

export default PylonIntegration;
