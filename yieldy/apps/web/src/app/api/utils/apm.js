/**
 * 0xCultiv8 APM (Application Performance Monitoring) Integration
 *
 * Provides comprehensive application monitoring including:
 * - Error tracking and reporting
 * - Performance tracing
 * - User session tracking
 * - Custom metrics
 *
 * Supports multiple backends: Sentry, DataDog, New Relic
 */

// ============================================================================
// APM Configuration
// ============================================================================

export const APM_BACKENDS = {
  SENTRY: 'sentry',
  DATADOG: 'datadog',
  NEWRELIC: 'newrelic',
  CONSOLE: 'console', // For development
};

const DEFAULT_CONFIG = {
  backend: process.env.APM_BACKEND || APM_BACKENDS.SENTRY,
  enabled: process.env.APM_ENABLED !== 'false',
  environment: process.env.NODE_ENV || 'development',
  release: process.env.VERSION || process.env.npm_package_version || 'unknown',
  sampleRate: parseFloat(process.env.APM_SAMPLE_RATE) || 1.0,
  tracesSampleRate: parseFloat(process.env.APM_TRACES_SAMPLE_RATE) || 0.1,

  // Sentry configuration
  sentry: {
    dsn: process.env.SENTRY_DSN,
    debug: process.env.NODE_ENV === 'development',
  },

  // DataDog configuration
  datadog: {
    clientToken: process.env.DD_CLIENT_TOKEN,
    applicationId: process.env.DD_APPLICATION_ID,
    site: process.env.DD_SITE || 'datadoghq.com',
    service: process.env.DD_SERVICE || 'cultiv8-web',
  },

  // New Relic configuration
  newrelic: {
    licenseKey: process.env.NEW_RELIC_LICENSE_KEY,
    appName: process.env.NEW_RELIC_APP_NAME || '0xCultiv8',
  },
};

// ============================================================================
// APM Manager Class
// ============================================================================

export class APMManager {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initialized = false;
    this.activeSpans = new Map();
    this.metrics = new Map();
  }

  /**
   * Initialize the APM backend
   */
  async initialize() {
    if (this.initialized || !this.config.enabled) {
      return;
    }

    try {
      switch (this.config.backend) {
        case APM_BACKENDS.SENTRY:
          await this.initializeSentry();
          break;
        case APM_BACKENDS.DATADOG:
          await this.initializeDataDog();
          break;
        case APM_BACKENDS.NEWRELIC:
          await this.initializeNewRelic();
          break;
        case APM_BACKENDS.CONSOLE:
          console.log('[APM] Console backend initialized');
          break;
        default:
          console.warn(`[APM] Unknown backend: ${this.config.backend}`);
      }

      this.initialized = true;
      console.log(`[APM] Initialized with backend: ${this.config.backend}`);
    } catch (error) {
      console.error('[APM] Failed to initialize:', error);
    }
  }

  /**
   * Initialize Sentry
   */
  async initializeSentry() {
    if (!this.config.sentry.dsn) {
      console.warn('[APM] Sentry DSN not configured');
      return;
    }

    // Dynamic import for Sentry (server-side)
    try {
      const Sentry = await import('@sentry/node');

      Sentry.init({
        dsn: this.config.sentry.dsn,
        environment: this.config.environment,
        release: this.config.release,
        sampleRate: this.config.sampleRate,
        tracesSampleRate: this.config.tracesSampleRate,
        debug: this.config.sentry.debug,
        integrations: [
          // Add default integrations
          Sentry.httpIntegration(),
          Sentry.onUncaughtExceptionIntegration(),
          Sentry.onUnhandledRejectionIntegration(),
        ],
        beforeSend(event, hint) {
          // Scrub sensitive data
          if (event.request?.headers) {
            delete event.request.headers['authorization'];
            delete event.request.headers['cookie'];
          }
          return event;
        },
      });

      this.sentryClient = Sentry;
      console.log('[APM] Sentry initialized');
    } catch (error) {
      console.warn('[APM] Sentry SDK not available:', error.message);
    }
  }

  /**
   * Initialize DataDog
   */
  async initializeDataDog() {
    if (!this.config.datadog.clientToken) {
      console.warn('[APM] DataDog client token not configured');
      return;
    }

    try {
      const ddTrace = await import('dd-trace');

      ddTrace.default.init({
        service: this.config.datadog.service,
        env: this.config.environment,
        version: this.config.release,
        logInjection: true,
        runtimeMetrics: true,
      });

      this.ddTracer = ddTrace.default;
      console.log('[APM] DataDog initialized');
    } catch (error) {
      console.warn('[APM] DataDog SDK not available:', error.message);
    }
  }

  /**
   * Initialize New Relic
   */
  async initializeNewRelic() {
    if (!this.config.newrelic.licenseKey) {
      console.warn('[APM] New Relic license key not configured');
      return;
    }

    try {
      const newrelic = await import('newrelic');
      this.newrelicClient = newrelic.default;
      console.log('[APM] New Relic initialized');
    } catch (error) {
      console.warn('[APM] New Relic SDK not available:', error.message);
    }
  }

  // ============================================================================
  // Error Tracking
  // ============================================================================

  /**
   * Capture and report an error
   */
  captureError(error, context = {}) {
    if (!this.config.enabled) return;

    const errorData = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      timestamp: new Date().toISOString(),
      ...context,
    };

    switch (this.config.backend) {
      case APM_BACKENDS.SENTRY:
        this.sentryClient?.captureException(error, {
          extra: context,
          tags: context.tags,
        });
        break;

      case APM_BACKENDS.DATADOG:
        // DataDog auto-captures errors, but we can add custom context
        this.ddTracer?.scope().active()?.setTag('error', true);
        break;

      case APM_BACKENDS.NEWRELIC:
        this.newrelicClient?.noticeError(error, context);
        break;

      case APM_BACKENDS.CONSOLE:
        console.error('[APM Error]', errorData);
        break;
    }

    return errorData;
  }

  /**
   * Capture a message (non-error event)
   */
  captureMessage(message, level = 'info', context = {}) {
    if (!this.config.enabled) return;

    switch (this.config.backend) {
      case APM_BACKENDS.SENTRY:
        this.sentryClient?.captureMessage(message, {
          level,
          extra: context,
        });
        break;

      case APM_BACKENDS.DATADOG:
        // Log to DataDog via tracer
        console.log(`[DD:${level}] ${message}`, context);
        break;

      case APM_BACKENDS.NEWRELIC:
        this.newrelicClient?.recordCustomEvent('Message', {
          message,
          level,
          ...context,
        });
        break;

      case APM_BACKENDS.CONSOLE:
        console.log(`[APM ${level}]`, message, context);
        break;
    }
  }

  // ============================================================================
  // Performance Tracing
  // ============================================================================

  /**
   * Start a performance trace/span
   */
  startSpan(name, options = {}) {
    if (!this.config.enabled) {
      return { end: () => {}, setTag: () => {} };
    }

    const spanId = `${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = performance.now();

    const span = {
      id: spanId,
      name,
      startTime,
      tags: options.tags || {},
      parentId: options.parentId,

      setTag: (key, value) => {
        span.tags[key] = value;
      },

      end: () => {
        const duration = performance.now() - startTime;
        this.endSpan(spanId, duration);
      },
    };

    this.activeSpans.set(spanId, span);

    // Backend-specific span creation
    switch (this.config.backend) {
      case APM_BACKENDS.SENTRY:
        if (this.sentryClient) {
          span.sentrySpan = this.sentryClient.startSpan({
            name,
            op: options.op || 'custom',
          });
        }
        break;

      case APM_BACKENDS.DATADOG:
        if (this.ddTracer) {
          span.ddSpan = this.ddTracer.startSpan(name, {
            tags: options.tags,
          });
        }
        break;

      case APM_BACKENDS.NEWRELIC:
        // New Relic uses segment API
        break;
    }

    return span;
  }

  /**
   * End a span and record metrics
   */
  endSpan(spanId, duration) {
    const span = this.activeSpans.get(spanId);
    if (!span) return;

    switch (this.config.backend) {
      case APM_BACKENDS.SENTRY:
        span.sentrySpan?.end();
        break;

      case APM_BACKENDS.DATADOG:
        span.ddSpan?.finish();
        break;

      case APM_BACKENDS.CONSOLE:
        console.log(`[APM Span] ${span.name}: ${duration.toFixed(2)}ms`, span.tags);
        break;
    }

    this.activeSpans.delete(spanId);

    // Record as metric
    this.recordMetric(`span.${span.name}.duration`, duration, 'histogram');
  }

  /**
   * Trace an async function
   */
  async trace(name, fn, options = {}) {
    const span = this.startSpan(name, options);

    try {
      const result = await fn();
      span.setTag('status', 'success');
      return result;
    } catch (error) {
      span.setTag('status', 'error');
      span.setTag('error.message', error.message);
      this.captureError(error, { spanName: name });
      throw error;
    } finally {
      span.end();
    }
  }

  // ============================================================================
  // Custom Metrics
  // ============================================================================

  /**
   * Record a custom metric
   */
  recordMetric(name, value, type = 'gauge', tags = {}) {
    if (!this.config.enabled) return;

    const metric = {
      name,
      value,
      type,
      tags,
      timestamp: Date.now(),
    };

    // Store locally for aggregation
    const key = `${name}:${JSON.stringify(tags)}`;
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    this.metrics.get(key).push(metric);

    // Send to backend
    switch (this.config.backend) {
      case APM_BACKENDS.DATADOG:
        // Use DogStatsD client if available
        break;

      case APM_BACKENDS.NEWRELIC:
        this.newrelicClient?.recordMetric(name, value);
        break;

      case APM_BACKENDS.CONSOLE:
        console.log(`[APM Metric] ${name}=${value} (${type})`, tags);
        break;
    }
  }

  /**
   * Increment a counter
   */
  incrementCounter(name, value = 1, tags = {}) {
    this.recordMetric(name, value, 'counter', tags);
  }

  /**
   * Record a histogram value
   */
  recordHistogram(name, value, tags = {}) {
    this.recordMetric(name, value, 'histogram', tags);
  }

  /**
   * Set a gauge value
   */
  setGauge(name, value, tags = {}) {
    this.recordMetric(name, value, 'gauge', tags);
  }

  // ============================================================================
  // User Context
  // ============================================================================

  /**
   * Set user context for error tracking
   */
  setUser(user) {
    if (!this.config.enabled) return;

    const userContext = {
      id: user.id || user.walletAddress,
      wallet: user.walletAddress,
      tier: user.tier,
    };

    switch (this.config.backend) {
      case APM_BACKENDS.SENTRY:
        this.sentryClient?.setUser(userContext);
        break;

      case APM_BACKENDS.DATADOG:
        this.ddTracer?.scope().active()?.setTag('user.id', userContext.id);
        break;

      case APM_BACKENDS.NEWRELIC:
        this.newrelicClient?.setCustomAttribute('userId', userContext.id);
        break;
    }
  }

  /**
   * Clear user context
   */
  clearUser() {
    switch (this.config.backend) {
      case APM_BACKENDS.SENTRY:
        this.sentryClient?.setUser(null);
        break;
    }
  }

  // ============================================================================
  // Transaction Tracking
  // ============================================================================

  /**
   * Track a blockchain transaction
   */
  trackTransaction(txData) {
    const {
      txHash,
      chain,
      protocol,
      action,
      amount,
      status,
      gasUsed,
      duration,
    } = txData;

    // Record transaction metrics
    this.incrementCounter('blockchain.transactions.total', 1, {
      chain,
      protocol,
      action,
      status,
    });

    if (status === 'success') {
      this.recordHistogram('blockchain.transactions.amount', amount, {
        chain,
        protocol,
        action,
      });

      this.recordHistogram('blockchain.transactions.gas', gasUsed, {
        chain,
        protocol,
      });

      this.recordHistogram('blockchain.transactions.duration', duration, {
        chain,
        protocol,
      });
    }

    // Log for analysis
    this.captureMessage(`Transaction ${status}: ${txHash}`, 'info', {
      chain,
      protocol,
      action,
      amount,
      gasUsed,
    });
  }

  /**
   * Track AI agent performance
   */
  trackAgentExecution(agentData) {
    const {
      sessionId,
      nodeExecutions,
      totalDuration,
      llmCalls,
      tokensUsed,
      result,
    } = agentData;

    this.recordHistogram('agent.execution.duration', totalDuration);
    this.recordHistogram('agent.execution.nodes', nodeExecutions);
    this.incrementCounter('agent.llm.calls', llmCalls);
    this.recordHistogram('agent.llm.tokens', tokensUsed);
    this.incrementCounter('agent.executions.total', 1, { result });
  }

  // ============================================================================
  // Flush and Cleanup
  // ============================================================================

  /**
   * Flush pending data to backend
   */
  async flush() {
    switch (this.config.backend) {
      case APM_BACKENDS.SENTRY:
        await this.sentryClient?.flush(2000);
        break;

      case APM_BACKENDS.DATADOG:
        // DataDog flushes automatically
        break;
    }
  }

  /**
   * Get aggregated metrics for Prometheus export
   */
  getMetrics() {
    const result = {};

    for (const [key, values] of this.metrics.entries()) {
      const [name] = key.split(':');

      if (!result[name]) {
        result[name] = {
          type: values[0]?.type || 'gauge',
          values: [],
        };
      }

      // Aggregate based on type
      const latestValue = values[values.length - 1]?.value || 0;
      const sum = values.reduce((acc, v) => acc + v.value, 0);

      result[name].values.push({
        value: values[0]?.type === 'counter' ? sum : latestValue,
        tags: JSON.parse(key.split(':')[1] || '{}'),
      });
    }

    return result;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let apmInstance = null;

export function getAPM() {
  if (!apmInstance) {
    apmInstance = new APMManager();
  }
  return apmInstance;
}

// Export convenience methods
export const apm = {
  async initialize() {
    return getAPM().initialize();
  },

  captureError(error, context) {
    return getAPM().captureError(error, context);
  },

  captureMessage(message, level, context) {
    return getAPM().captureMessage(message, level, context);
  },

  startSpan(name, options) {
    return getAPM().startSpan(name, options);
  },

  async trace(name, fn, options) {
    return getAPM().trace(name, fn, options);
  },

  recordMetric(name, value, type, tags) {
    return getAPM().recordMetric(name, value, type, tags);
  },

  incrementCounter(name, value, tags) {
    return getAPM().incrementCounter(name, value, tags);
  },

  recordHistogram(name, value, tags) {
    return getAPM().recordHistogram(name, value, tags);
  },

  setGauge(name, value, tags) {
    return getAPM().setGauge(name, value, tags);
  },

  setUser(user) {
    return getAPM().setUser(user);
  },

  trackTransaction(txData) {
    return getAPM().trackTransaction(txData);
  },

  trackAgentExecution(agentData) {
    return getAPM().trackAgentExecution(agentData);
  },

  async flush() {
    return getAPM().flush();
  },

  getMetrics() {
    return getAPM().getMetrics();
  },
};
