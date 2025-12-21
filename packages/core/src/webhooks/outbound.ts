/**
 * Outbound Webhook Manager
 *
 * Triggers outbound webhooks to notify external systems (e.g., Vercel deploy hooks,
 * CI systems) after webhook batches are processed. Enables the "30 webhooks → 1 build"
 * optimization.
 */

import type { WebhookBatch } from './queue.js';

/**
 * Configuration for an outbound webhook trigger.
 */
export interface OutboundWebhookConfig {
  /** URL to POST to */
  url: string;
  /**
   * Events to trigger on. '*' = all events.
   * @default ['*']
   */
  events?: string[];
  /** Custom headers to include in the request */
  headers?: Record<string, string>;
  /**
   * Number of retries on failure.
   * @default 3
   */
  retries?: number;
  /**
   * Base delay between retries in milliseconds.
   * Uses exponential backoff: retryDelayMs * (attempt + 1)
   * @default 1000
   */
  retryDelayMs?: number;
}

/**
 * Payload sent to outbound webhook endpoints.
 */
export interface OutboundWebhookPayload {
  /** Event type */
  event: 'batch-complete';
  /** Timestamp of batch completion (ISO 8601) */
  timestamp: string;
  /** Summary of what changed */
  summary: {
    /** Number of webhooks in batch */
    webhookCount: number;
    /** Plugins that were updated */
    plugins: string[];
    /** Node types that were updated (if available) */
    nodeTypes?: string[];
  };
  /** UDL instance identifier (for multi-instance setups) */
  source: string;
}

/**
 * Result of triggering an outbound webhook.
 */
export interface OutboundWebhookResult {
  /** The webhook configuration */
  config: OutboundWebhookConfig;
  /** Whether the webhook was successfully sent */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Number of attempts made */
  attempts: number;
}

/**
 * Manages outbound webhook notifications after batch processing.
 *
 * @example
 * ```typescript
 * const manager = new OutboundWebhookManager([
 *   {
 *     url: 'https://api.vercel.com/v1/integrations/deploy/...',
 *     retries: 3,
 *   },
 * ]);
 *
 * webhookQueue.on('webhook:batch-complete', (batch) => {
 *   manager.triggerAll(batch);
 * });
 * ```
 */
export class OutboundWebhookManager {
  private configs: OutboundWebhookConfig[];

  constructor(configs: OutboundWebhookConfig[] = []) {
    this.configs = configs;
  }

  /**
   * Trigger all configured outbound webhooks with the batch summary.
   * All webhooks are triggered in parallel using Promise.allSettled.
   * Errors are logged but do not throw.
   *
   * @param batch - The completed webhook batch
   * @returns Results for each configured webhook
   */
  async triggerAll(batch: WebhookBatch): Promise<OutboundWebhookResult[]> {
    if (this.configs.length === 0) {
      return [];
    }

    const payload = this.createPayload(batch);

    const promises = this.configs.map((config) =>
      this.trigger(config, payload)
    );

    const settledResults = await Promise.allSettled(promises);

    const results: OutboundWebhookResult[] = settledResults.map(
      (result, index) => {
        const config = this.configs[index]!;

        if (result.status === 'fulfilled') {
          if (result.value.success) {
            console.log(`📤 Outbound webhook sent: ${config.url}`);
          } else {
            console.error(
              `❌ Outbound webhook failed: ${config.url} - ${result.value.error}`
            );
          }
          return result.value;
        } else {
          // This shouldn't happen since trigger() catches errors, but handle it anyway
          console.error(
            `❌ Outbound webhook failed: ${config.url}`,
            result.reason
          );
          return {
            config,
            success: false,
            error:
              result.reason instanceof Error
                ? result.reason.message
                : String(result.reason),
            attempts: 0,
          };
        }
      }
    );

    return results;
  }

  /**
   * Trigger a single outbound webhook with retry logic.
   *
   * @param config - The webhook configuration
   * @param payload - The payload to send
   * @returns The result of the trigger attempt
   */
  private async trigger(
    config: OutboundWebhookConfig,
    payload: OutboundWebhookPayload
  ): Promise<OutboundWebhookResult> {
    const { url, headers = {}, retries = 3, retryDelayMs = 1000 } = config;

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'UDL-Webhook/1.0',
            ...headers,
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return {
          config,
          success: true,
          attempts: attempt + 1,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < retries) {
          const delay = retryDelayMs * (attempt + 1);
          console.warn(
            `⚠️ Outbound webhook retry ${attempt + 1}/${retries}: ${url} (waiting ${delay}ms)`
          );
          await this.sleep(delay);
        }
      }
    }

    return {
      config,
      success: false,
      error: lastError?.message ?? 'Unknown error',
      attempts: retries + 1,
    };
  }

  /**
   * Create the outbound webhook payload from a batch.
   *
   * @param batch - The completed webhook batch
   * @returns The payload to send
   */
  private createPayload(batch: WebhookBatch): OutboundWebhookPayload {
    // Extract unique plugin names from the batch
    const plugins = [...new Set(batch.webhooks.map((w) => w.pluginName))];

    return {
      event: 'batch-complete',
      timestamp: new Date(batch.completedAt).toISOString(),
      summary: {
        webhookCount: batch.webhooks.length,
        plugins,
      },
      source: process.env['UDL_INSTANCE_ID'] || 'default',
    };
  }

  /**
   * Sleep for the specified duration.
   *
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get the number of configured outbound webhooks.
   */
  getConfigCount(): number {
    return this.configs.length;
  }
}
