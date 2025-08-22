// analytics.js
import { supabase } from './supabase.js';

class SupportAnalytics {
  constructor() {
    this.metrics = {
      totalTickets: 0,
      ticketsByChannel: { discord: 0, email: 0 },
      ticketsByCategory: {},
      ticketsBySeverity: {},
      avgResponseTime: 0,
      resolutionRate: 0
    };
  }

  async trackTicket(source, category, severity, responseTime = 0) {
    try {
      // Update local metrics
      this.metrics.totalTickets++;
      this.metrics.ticketsByChannel[source] = (this.metrics.ticketsByChannel[source] || 0) + 1;
      this.metrics.ticketsByCategory[category] = (this.metrics.ticketsByCategory[category] || 0) + 1;
      this.metrics.ticketsBySeverity[severity] = (this.metrics.ticketsBySeverity[severity] || 0) + 1;

      // Store in Supabase if available
      if (supabase) {
        await supabase.from('support_metrics').insert({
          source,
          category,
          severity,
          response_time_ms: responseTime,
          created_at: new Date().toISOString()
        });
      }

      console.log(`📊 Ticket tracked: ${source} | ${category} | ${severity}`);
    } catch (error) {
      console.error('Error tracking ticket:', error);
    }
  }

  async getMetrics() {
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('tickets')
          .select('*')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        if (!error && data) {
          return this.calculateMetrics(data);
        }
      }

      return this.metrics;
    } catch (error) {
      console.error('Error getting metrics:', error);
      return this.metrics;
    }
  }

  calculateMetrics(tickets) {
    const metrics = {
      totalTickets: tickets.length,
      ticketsByChannel: {},
      ticketsByCategory: {},
      ticketsBySeverity: {},
      avgResponseTime: 0,
      resolutionRate: 0
    };

    tickets.forEach(ticket => {
      // Channel breakdown
      metrics.ticketsByChannel[ticket.source] = (metrics.ticketsByChannel[ticket.source] || 0) + 1;
      
      // Category breakdown
      metrics.ticketsByCategory[ticket.category] = (metrics.ticketsByCategory[ticket.category] || 0) + 1;
      
      // Severity breakdown (if available)
      if (ticket.severity) {
        metrics.ticketsBySeverity[ticket.severity] = (metrics.ticketsBySeverity[ticket.severity] || 0) + 1;
      }
    });

    return metrics;
  }

  generateReport() {
    const report = `
📊 **Firecrawl Support Analytics (24h)**

**Total Tickets:** ${this.metrics.totalTickets}

**By Channel:**
${Object.entries(this.metrics.ticketsByChannel).map(([channel, count]) => `- ${channel}: ${count}`).join('\n')}

**By Category:**
${Object.entries(this.metrics.ticketsByCategory).map(([category, count]) => `- ${category}: ${count}`).join('\n')}

**By Severity:**
${Object.entries(this.metrics.ticketsBySeverity).map(([severity, count]) => `- ${severity}: ${count}`).join('\n')}
    `.trim();

    return report;
  }
}

export const analytics = new SupportAnalytics();
