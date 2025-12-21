/**
 * Secure Key Management Module
 * Provides centralized secret management with multiple backend support
 *
 * Supported backends:
 * - AWS KMS (production)
 * - HashiCorp Vault (alternative production)
 * - Environment variables (development only)
 *
 * Features:
 * - Key rotation support
 * - Audit logging for all key access
 * - Caching with configurable TTL
 * - Automatic backend selection
 *
 * @module keyManager
 */

import { log } from './logger.js';
import { auditLog, AUDIT_ACTIONS } from './auditLogger.js';
import { alertManager, SEVERITY, ALERT_TYPES } from './alerting.js';

/**
 * Key types managed by KeyManager
 */
export const KEY_TYPES = {
  AGENT_PRIVATE_KEY: 'agent_private_key',
  ENCRYPTION_KEY: 'encryption_key',
  API_KEY: 'api_key',
  SIGNING_KEY: 'signing_key',
};

/**
 * Secret backend types
 */
export const BACKEND_TYPES = {
  AWS_KMS: 'aws_kms',
  VAULT: 'vault',
  ENV: 'env',
};

/**
 * KeyManager - Secure secrets management
 */
export class KeyManager {
  constructor(config = {}) {
    this.config = {
      backend: process.env.KEY_MANAGER_BACKEND || BACKEND_TYPES.ENV,
      cacheTTL: parseInt(process.env.KEY_CACHE_TTL_MS) || 300000, // 5 min default
      auditEnabled: process.env.KEY_AUDIT_ENABLED !== 'false',

      // AWS KMS configuration
      aws: {
        region: process.env.AWS_REGION || 'us-east-1',
        keyId: process.env.AWS_KMS_KEY_ID,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },

      // HashiCorp Vault configuration
      vault: {
        endpoint: process.env.VAULT_ADDR || 'http://localhost:8200',
        token: process.env.VAULT_TOKEN,
        namespace: process.env.VAULT_NAMESPACE,
        secretPath: process.env.VAULT_SECRET_PATH || 'secret/data/cultiv8',
      },

      ...config,
    };

    // In-memory cache for secrets
    this.cache = new Map();

    // AWS SDK client (lazy-loaded)
    this.kmsClient = null;

    // Track key access for audit
    this.accessLog = [];

    log.info('KeyManager initialized', {
      backend: this.config.backend,
      auditEnabled: this.config.auditEnabled,
    });
  }

  /**
   * Get a secret value by key type
   * @param {string} keyType - Type of key to retrieve (from KEY_TYPES)
   * @param {object} options - Retrieval options
   * @returns {Promise<string>} - Secret value
   */
  async getSecret(keyType, options = {}) {
    const { bypassCache = false, caller = 'unknown' } = options;

    // Check cache first
    if (!bypassCache) {
      const cached = this.getFromCache(keyType);
      if (cached) {
        this.recordAccess(keyType, caller, 'cache_hit');
        return cached;
      }
    }

    // Retrieve from backend
    let secret;
    switch (this.config.backend) {
      case BACKEND_TYPES.AWS_KMS:
        secret = await this.getFromKMS(keyType);
        break;
      case BACKEND_TYPES.VAULT:
        secret = await this.getFromVault(keyType);
        break;
      case BACKEND_TYPES.ENV:
      default:
        secret = this.getFromEnv(keyType);
        break;
    }

    if (!secret) {
      this.recordAccess(keyType, caller, 'not_found');
      throw new Error(`Secret not found: ${keyType}`);
    }

    // Cache the secret
    this.setCache(keyType, secret);
    this.recordAccess(keyType, caller, 'retrieved');

    return secret;
  }

  /**
   * Get secret from environment variables (development only)
   */
  getFromEnv(keyType) {
    const envMapping = {
      [KEY_TYPES.AGENT_PRIVATE_KEY]: 'AGENT_PRIVATE_KEY',
      [KEY_TYPES.ENCRYPTION_KEY]: 'ENCRYPTION_KEY',
      [KEY_TYPES.API_KEY]: 'API_KEY',
      [KEY_TYPES.SIGNING_KEY]: 'SIGNING_KEY',
    };

    const envVar = envMapping[keyType] || keyType.toUpperCase();
    const value = process.env[envVar];

    if (process.env.NODE_ENV === 'production' && this.config.backend === BACKEND_TYPES.ENV) {
      log.warn('Using environment variables for secrets in production - NOT RECOMMENDED', { keyType });
    }

    return value;
  }

  /**
   * Get secret from AWS KMS
   */
  async getFromKMS(keyType) {
    try {
      // Lazy-load AWS SDK
      if (!this.kmsClient) {
        const { KMSClient, DecryptCommand } = await import('@aws-sdk/client-kms');
        this.kmsClient = new KMSClient({
          region: this.config.aws.region,
          credentials: this.config.aws.accessKeyId ? {
            accessKeyId: this.config.aws.accessKeyId,
            secretAccessKey: this.config.aws.secretAccessKey,
          } : undefined, // Use default credential chain if not specified
        });
      }

      // In AWS KMS flow, secrets are typically stored encrypted and decrypted on access
      // Here we assume the encrypted value is stored in an env var or fetched from parameter store
      const encryptedValue = process.env[`KMS_ENCRYPTED_${keyType.toUpperCase()}`];

      if (!encryptedValue) {
        throw new Error(`No encrypted value found for ${keyType}`);
      }

      const { DecryptCommand } = await import('@aws-sdk/client-kms');
      const command = new DecryptCommand({
        CiphertextBlob: Buffer.from(encryptedValue, 'base64'),
        KeyId: this.config.aws.keyId,
      });

      const response = await this.kmsClient.send(command);
      const decrypted = new TextDecoder().decode(response.Plaintext);

      log.debug('Secret retrieved from AWS KMS', { keyType });
      return decrypted;
    } catch (error) {
      log.error('Failed to retrieve secret from AWS KMS', { keyType, error: error.message });
      throw error;
    }
  }

  /**
   * Get secret from HashiCorp Vault
   */
  async getFromVault(keyType) {
    try {
      const vaultUrl = `${this.config.vault.endpoint}/v1/${this.config.vault.secretPath}`;

      const headers = {
        'X-Vault-Token': this.config.vault.token,
      };

      if (this.config.vault.namespace) {
        headers['X-Vault-Namespace'] = this.config.vault.namespace;
      }

      const response = await fetch(vaultUrl, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Vault returned ${response.status}`);
      }

      const data = await response.json();
      const secret = data.data?.data?.[keyType] || data.data?.[keyType];

      if (!secret) {
        throw new Error(`Key ${keyType} not found in Vault`);
      }

      log.debug('Secret retrieved from Vault', { keyType });
      return secret;
    } catch (error) {
      log.error('Failed to retrieve secret from Vault', { keyType, error: error.message });
      throw error;
    }
  }

  /**
   * Get from cache
   */
  getFromCache(keyType) {
    const cached = this.cache.get(keyType);
    if (!cached) return null;

    if (Date.now() > cached.expiresAt) {
      this.cache.delete(keyType);
      return null;
    }

    return cached.value;
  }

  /**
   * Set cache
   */
  setCache(keyType, value) {
    this.cache.set(keyType, {
      value,
      expiresAt: Date.now() + this.config.cacheTTL,
      cachedAt: Date.now(),
    });
  }

  /**
   * Invalidate cached secret
   */
  invalidateCache(keyType) {
    if (keyType) {
      this.cache.delete(keyType);
      log.info('Secret cache invalidated', { keyType });
    } else {
      this.cache.clear();
      log.info('All secret caches invalidated');
    }
  }

  /**
   * Record access for audit
   */
  async recordAccess(keyType, caller, action) {
    if (!this.config.auditEnabled) return;

    const accessRecord = {
      keyType,
      caller,
      action,
      timestamp: new Date().toISOString(),
      backend: this.config.backend,
    };

    // Keep last 1000 accesses in memory
    this.accessLog.push(accessRecord);
    if (this.accessLog.length > 1000) {
      this.accessLog = this.accessLog.slice(-1000);
    }

    // Audit log sensitive key access
    if (keyType === KEY_TYPES.AGENT_PRIVATE_KEY) {
      await auditLog({
        user_id: caller,
        action: AUDIT_ACTIONS.KEY_ACCESSED || 'KEY_ACCESSED',
        resource_type: 'secret',
        resource_id: keyType,
        metadata: {
          action,
          backend: this.config.backend,
        },
        success: action !== 'not_found',
      });
    }
  }

  /**
   * Get access log for audit review
   */
  getAccessLog(options = {}) {
    const { keyType, caller, limit = 100 } = options;

    let logs = [...this.accessLog];

    if (keyType) {
      logs = logs.filter(l => l.keyType === keyType);
    }
    if (caller) {
      logs = logs.filter(l => l.caller === caller);
    }

    return logs.slice(-limit);
  }

  /**
   * Rotate a secret (for backends that support it)
   * @param {string} keyType - Type of key to rotate
   * @param {string} newValue - Optional new value (generated if not provided)
   * @returns {Promise<object>} - Rotation result
   */
  async rotateSecret(keyType, newValue = null) {
    if (this.config.backend === BACKEND_TYPES.ENV) {
      throw new Error('Secret rotation not supported with environment variable backend');
    }

    // Alert on key rotation start
    await alertManager.send({
      title: 'Secret Rotation Initiated',
      message: `Secret ${keyType} rotation starting`,
      severity: SEVERITY.HIGH,
      type: ALERT_TYPES.SECURITY_EVENT,
      context: { keyType, backend: this.config.backend },
    });

    // Get current value for backup reference
    let previousValue = null;
    try {
      previousValue = await this.getSecret(keyType, { bypassCache: true });
    } catch (e) {
      log.warn('Could not retrieve current value during rotation', { keyType });
    }

    // Generate new value if not provided
    const rotationValue = newValue || await this.generateSecretValue(keyType);

    try {
      let result;
      switch (this.config.backend) {
        case BACKEND_TYPES.AWS_KMS:
          result = await this.rotateInKMS(keyType, rotationValue);
          break;
        case BACKEND_TYPES.VAULT:
          result = await this.rotateInVault(keyType, rotationValue, previousValue);
          break;
        default:
          throw new Error(`Rotation not supported for backend: ${this.config.backend}`);
      }

      // Invalidate cache
      this.invalidateCache(keyType);

      // Audit log the rotation
      await auditLog({
        user_id: 'system',
        action: AUDIT_ACTIONS.KEY_ROTATED || 'KEY_ROTATED',
        resource_type: 'secret',
        resource_id: keyType,
        metadata: {
          backend: this.config.backend,
          rotatedAt: new Date().toISOString(),
        },
        success: true,
      });

      log.info('Secret rotation completed', { keyType, backend: this.config.backend });

      // Alert on successful rotation
      await alertManager.send({
        title: 'Secret Rotation Completed',
        message: `Secret ${keyType} has been successfully rotated`,
        severity: SEVERITY.INFO,
        type: ALERT_TYPES.SECURITY_EVENT,
        context: { keyType, backend: this.config.backend },
      });

      return { success: true, ...result };
    } catch (error) {
      log.error('Secret rotation failed', { keyType, error: error.message });

      // Alert on rotation failure
      await alertManager.send({
        title: 'Secret Rotation Failed',
        message: `Failed to rotate secret ${keyType}: ${error.message}`,
        severity: SEVERITY.CRITICAL,
        type: ALERT_TYPES.SECURITY_EVENT,
        context: { keyType, backend: this.config.backend, error: error.message },
      });

      throw error;
    }
  }

  /**
   * Generate a new secret value based on key type
   */
  async generateSecretValue(keyType) {
    const { randomBytes } = await import('crypto');

    switch (keyType) {
      case KEY_TYPES.AGENT_PRIVATE_KEY:
        // Generate a new Ethereum private key
        const { ethers } = await import('ethers');
        const wallet = ethers.Wallet.createRandom();
        return wallet.privateKey;

      case KEY_TYPES.ENCRYPTION_KEY:
        // 256-bit encryption key
        return randomBytes(32).toString('hex');

      case KEY_TYPES.API_KEY:
        // API key format: prefix + random
        return `sk_${randomBytes(24).toString('base64url')}`;

      case KEY_TYPES.SIGNING_KEY:
        // 512-bit signing key
        return randomBytes(64).toString('hex');

      default:
        return randomBytes(32).toString('hex');
    }
  }

  /**
   * Rotate secret in AWS KMS
   */
  async rotateInKMS(keyType, newValue) {
    try {
      const { KMSClient, EncryptCommand } = await import('@aws-sdk/client-kms');

      if (!this.kmsClient) {
        this.kmsClient = new KMSClient({
          region: this.config.aws.region,
          credentials: this.config.aws.accessKeyId ? {
            accessKeyId: this.config.aws.accessKeyId,
            secretAccessKey: this.config.aws.secretAccessKey,
          } : undefined,
        });
      }

      // Encrypt the new value with KMS
      const command = new EncryptCommand({
        KeyId: this.config.aws.keyId,
        Plaintext: Buffer.from(newValue),
      });

      const response = await this.kmsClient.send(command);
      const encryptedValue = Buffer.from(response.CiphertextBlob).toString('base64');

      // Store encrypted value in AWS Secrets Manager or Parameter Store
      // For now, return the encrypted value for manual update
      return {
        message: 'Encrypted value generated for KMS',
        envVarName: `KMS_ENCRYPTED_${keyType.toUpperCase()}`,
        encryptedValue,
        action: 'Update environment variable or Secrets Manager with encrypted value',
      };
    } catch (error) {
      log.error('Failed to rotate secret in KMS', { keyType, error: error.message });
      throw error;
    }
  }

  /**
   * Rotate secret in HashiCorp Vault
   */
  async rotateInVault(keyType, newValue, previousValue) {
    try {
      // Get all current secrets first to preserve other values
      const getResponse = await fetch(
        `${this.config.vault.endpoint}/v1/${this.config.vault.secretPath}`,
        {
          method: 'GET',
          headers: this.getVaultHeaders(),
        }
      );

      let currentData = {};
      if (getResponse.ok) {
        const getData = await getResponse.json();
        currentData = getData.data?.data || getData.data || {};
      }

      // Store the previous value for rollback capability
      const previousKeyName = `${keyType}_previous`;
      if (previousValue) {
        currentData[previousKeyName] = previousValue;
      }

      // Update with new value
      currentData[keyType] = newValue;
      currentData[`${keyType}_rotated_at`] = new Date().toISOString();

      // Write updated secrets
      const putResponse = await fetch(
        `${this.config.vault.endpoint}/v1/${this.config.vault.secretPath}`,
        {
          method: 'POST',
          headers: {
            ...this.getVaultHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ data: currentData }),
        }
      );

      if (!putResponse.ok) {
        const errorData = await putResponse.text();
        throw new Error(`Vault write failed: ${putResponse.status} - ${errorData}`);
      }

      return {
        message: 'Secret rotated in Vault',
        previousValuePreserved: !!previousValue,
        rotatedAt: currentData[`${keyType}_rotated_at`],
      };
    } catch (error) {
      log.error('Failed to rotate secret in Vault', { keyType, error: error.message });
      throw error;
    }
  }

  /**
   * Get Vault headers for requests
   */
  getVaultHeaders() {
    const headers = {
      'X-Vault-Token': this.config.vault.token,
    };
    if (this.config.vault.namespace) {
      headers['X-Vault-Namespace'] = this.config.vault.namespace;
    }
    return headers;
  }

  /**
   * Schedule automatic key rotation
   * @param {string} keyType - Key type to rotate
   * @param {number} intervalDays - Rotation interval in days
   */
  scheduleRotation(keyType, intervalDays = 90) {
    const intervalMs = intervalDays * 24 * 60 * 60 * 1000;

    log.info('Scheduling automatic key rotation', { keyType, intervalDays });

    setInterval(async () => {
      try {
        await this.rotateSecret(keyType);
        log.info('Scheduled key rotation completed', { keyType });
      } catch (error) {
        log.error('Scheduled key rotation failed', { keyType, error: error.message });
      }
    }, intervalMs);

    return { scheduled: true, keyType, intervalDays };
  }

  /**
   * Rollback to previous secret value (for Vault backend)
   */
  async rollbackSecret(keyType) {
    if (this.config.backend !== BACKEND_TYPES.VAULT) {
      throw new Error('Rollback only supported with Vault backend');
    }

    try {
      // Get current secrets including previous value
      const response = await fetch(
        `${this.config.vault.endpoint}/v1/${this.config.vault.secretPath}`,
        {
          method: 'GET',
          headers: this.getVaultHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch current secrets');
      }

      const data = await response.json();
      const currentData = data.data?.data || data.data || {};
      const previousValue = currentData[`${keyType}_previous`];

      if (!previousValue) {
        throw new Error('No previous value available for rollback');
      }

      // Swap current and previous
      const currentValue = currentData[keyType];
      currentData[keyType] = previousValue;
      currentData[`${keyType}_previous`] = currentValue;
      currentData[`${keyType}_rolled_back_at`] = new Date().toISOString();

      // Write back
      const putResponse = await fetch(
        `${this.config.vault.endpoint}/v1/${this.config.vault.secretPath}`,
        {
          method: 'POST',
          headers: {
            ...this.getVaultHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ data: currentData }),
        }
      );

      if (!putResponse.ok) {
        throw new Error('Failed to write rollback');
      }

      // Invalidate cache
      this.invalidateCache(keyType);

      // Alert on rollback
      await alertManager.send({
        title: 'Secret Rollback Completed',
        message: `Secret ${keyType} has been rolled back to previous value`,
        severity: SEVERITY.HIGH,
        type: ALERT_TYPES.SECURITY_EVENT,
        context: { keyType, backend: this.config.backend },
      });

      log.info('Secret rollback completed', { keyType });

      return { success: true, rolledBackAt: currentData[`${keyType}_rolled_back_at`] };
    } catch (error) {
      log.error('Secret rollback failed', { keyType, error: error.message });
      throw error;
    }
  }

  /**
   * Check backend health
   */
  async checkHealth() {
    const health = {
      backend: this.config.backend,
      healthy: false,
      cacheSize: this.cache.size,
      lastAccess: this.accessLog.length > 0 ? this.accessLog[this.accessLog.length - 1] : null,
    };

    try {
      switch (this.config.backend) {
        case BACKEND_TYPES.AWS_KMS:
          // Try to describe the key
          if (this.config.aws.keyId) {
            health.healthy = true; // Simplified - would normally make API call
          }
          break;

        case BACKEND_TYPES.VAULT:
          // Try to get Vault health
          const response = await fetch(`${this.config.vault.endpoint}/v1/sys/health`, {
            method: 'GET',
          });
          health.healthy = response.ok;
          health.vaultSealed = !response.ok;
          break;

        case BACKEND_TYPES.ENV:
        default:
          // Environment always "healthy"
          health.healthy = true;
          health.warning = 'Using environment variables - not recommended for production';
          break;
      }
    } catch (error) {
      health.healthy = false;
      health.error = error.message;
    }

    return health;
  }

  /**
   * Get a signer from the stored private key
   * This is the secure way to get a wallet for signing
   */
  async getAgentSigner(provider) {
    const { ethers } = await import('ethers');

    const privateKey = await this.getSecret(KEY_TYPES.AGENT_PRIVATE_KEY, {
      caller: 'agent_signer',
    });

    if (!privateKey) {
      throw new Error('Agent private key not available');
    }

    return new ethers.Wallet(privateKey, provider);
  }
}

// Singleton instance
let keyManagerInstance = null;

/**
 * Get the KeyManager singleton
 */
export function getKeyManager() {
  if (!keyManagerInstance) {
    keyManagerInstance = new KeyManager();
  }
  return keyManagerInstance;
}

/**
 * Convenience function to get a secret
 */
export async function getSecret(keyType, options = {}) {
  return getKeyManager().getSecret(keyType, options);
}

/**
 * Convenience function to get agent signer
 */
export async function getAgentSigner(provider) {
  return getKeyManager().getAgentSigner(provider);
}

/**
 * Environment variable template for .env.example
 */
export const ENV_TEMPLATE = `
# =============================================================================
# KEY MANAGER CONFIGURATION
# =============================================================================

# Backend type: aws_kms | vault | env
KEY_MANAGER_BACKEND=env

# Cache TTL in milliseconds (default: 5 minutes)
KEY_CACHE_TTL_MS=300000

# Enable audit logging for key access
KEY_AUDIT_ENABLED=true

# =============================================================================
# AWS KMS Configuration (if using aws_kms backend)
# =============================================================================
AWS_REGION=us-east-1
AWS_KMS_KEY_ID=alias/cultiv8-secrets
# AWS_ACCESS_KEY_ID=  # Optional if using IAM roles
# AWS_SECRET_ACCESS_KEY=

# Encrypted secrets (base64-encoded ciphertext)
# KMS_ENCRYPTED_AGENT_PRIVATE_KEY=
# KMS_ENCRYPTED_ENCRYPTION_KEY=

# =============================================================================
# HashiCorp Vault Configuration (if using vault backend)
# =============================================================================
VAULT_ADDR=https://vault.example.com
VAULT_TOKEN=
VAULT_NAMESPACE=
VAULT_SECRET_PATH=secret/data/cultiv8

# =============================================================================
# Environment Variables (if using env backend - DEVELOPMENT ONLY)
# =============================================================================
# AGENT_PRIVATE_KEY=  # DO NOT USE IN PRODUCTION
`;
