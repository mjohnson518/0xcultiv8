import { verifyMessage, getAddress, recoverAddress } from 'ethers';
import sql from './sql';

/**
 * Wallet-based authentication using EIP-191 signatures
 * Used for operations that require wallet signature verification
 */

/**
 * Generate nonce for wallet signature
 * @param {string} address - Ethereum address
 * @returns {Promise<string>} - Nonce string
 */
export async function generateNonce(address) {
  const nonce = Math.random().toString(36).substring(2, 15);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  // Store nonce in database
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS wallet_nonces (
        address TEXT PRIMARY KEY,
        nonce TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      INSERT INTO wallet_nonces (address, nonce, expires_at)
      VALUES (${address.toLowerCase()}, ${nonce}, ${expiresAt})
      ON CONFLICT (address) 
      DO UPDATE SET nonce = ${nonce}, expires_at = ${expiresAt}, created_at = NOW()
    `;
  } catch (error) {
    console.error('Error storing nonce:', error);
  }

  return nonce;
}

/**
 * Verify wallet signature (EIP-191)
 * @param {string} address - Ethereum address that signed
 * @param {string} signature - Signature to verify
 * @param {string} nonce - Nonce used in message
 * @returns {Promise<boolean>} - True if signature is valid
 */
export async function verifyWalletSignature(address, signature, nonce) {
  try {
    // Get checksummed address
    const checksumAddress = getAddress(address);

    // Verify nonce is valid and not expired
    const nonceRecord = await sql`
      SELECT * FROM wallet_nonces 
      WHERE address = ${address.toLowerCase()}
      AND nonce = ${nonce}
      AND expires_at > NOW()
    `;

    if (!nonceRecord || nonceRecord.length === 0) {
      console.warn('Invalid or expired nonce:', { address, nonce });
      return false;
    }

    // Construct the message that was signed
    const message = `Sign this message to authenticate with Cultiv8 Agent.\n\nNonce: ${nonce}\nAddress: ${checksumAddress}`;

    // Verify signature
    const recoveredAddress = verifyMessage(message, signature);

    // Check if recovered address matches
    const isValid = recoveredAddress.toLowerCase() === address.toLowerCase();

    if (isValid) {
      // Delete used nonce (prevent replay)
      await sql`DELETE FROM wallet_nonces WHERE address = ${address.toLowerCase()} AND nonce = ${nonce}`;
    }

    return isValid;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Recover address from signature
 * @param {string} message - Original message
 * @param {string} signature - Signature
 * @returns {string|null} - Recovered address or null
 */
export function recoverSignerAddress(message, signature) {
  try {
    return recoverAddress(message, signature);
  } catch (error) {
    console.error('Address recovery error:', error);
    return null;
  }
}

/**
 * Middleware requiring wallet signature verification
 * @param {Request} request - Request must include wallet and signature
 * @returns {Response|null} - Error if invalid, null if valid
 */
export async function requireWalletSignature(request) {
  try {
    const body = await request.clone().json();
    const { wallet, signature, nonce } = body;

    if (!wallet || !signature || !nonce) {
      return new Response(
        JSON.stringify({
          error: 'Missing wallet authentication',
          message: 'Wallet address, signature, and nonce are required',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const isValid = await verifyWalletSignature(wallet, signature, nonce);

    if (!isValid) {
      return new Response(
        JSON.stringify({
          error: 'Invalid signature',
          message: 'Wallet signature verification failed',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Attach wallet to request
    request.wallet = {
      address: getAddress(wallet),
      verified: true,
    };

    return null;
  } catch (error) {
    console.error('Wallet auth middleware error:', error);
    return new Response(
      JSON.stringify({
        error: 'Authentication error',
        message: 'Failed to verify wallet signature',
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Generate authentication message for wallet signing
 * @param {string} address - Wallet address
 * @param {string} nonce - Nonce
 * @returns {string} - Message to sign
 */
export function generateAuthMessage(address, nonce) {
  const checksumAddress = getAddress(address);
  return `Sign this message to authenticate with Cultiv8 Agent.\n\nNonce: ${nonce}\nAddress: ${checksumAddress}\n\nThis request will not trigger a blockchain transaction or cost any gas fees.`;
}

