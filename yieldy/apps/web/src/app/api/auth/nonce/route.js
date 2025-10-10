import { generateNonce, generateAuthMessage } from '@/app/api/utils/walletAuth';
import { isAddress, getAddress } from 'ethers';

/**
 * Generate nonce for wallet signature authentication
 * GET /api/auth/nonce?address=0x...
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return Response.json(
        {
          error: 'Missing address parameter',
        },
        { status: 400 }
      );
    }

    if (!isAddress(address)) {
      return Response.json(
        {
          error: 'Invalid Ethereum address',
        },
        { status: 400 }
      );
    }

    const checksumAddress = getAddress(address);
    const nonce = await generateNonce(checksumAddress);
    const message = generateAuthMessage(checksumAddress, nonce);

    return Response.json({
      success: true,
      nonce,
      message,
      address: checksumAddress,
      expiresIn: 300, // 5 minutes in seconds
    });
  } catch (error) {
    console.error('Nonce generation error:', error);
    return Response.json(
      {
        error: 'Failed to generate nonce',
      },
      { status: 500 }
    );
  }
}

