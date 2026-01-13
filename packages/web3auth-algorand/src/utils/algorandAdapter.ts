import { IProvider } from '@web3auth/base'
import algosdk from 'algosdk'

export interface AlgorandAccountFromWeb3Auth {
  address: string
  mnemonic: string
  secretKey: Uint8Array
}

export async function getAlgorandAccount(provider: IProvider): Promise<AlgorandAccountFromWeb3Auth> {
  if (!provider) {
    throw new Error('Provider is required to derive Algorand account')
  }

  try {
    const privKey = await provider.request({
      method: 'private_key',
    })

    if (!privKey || typeof privKey !== 'string') {
      throw new Error('Failed to retrieve private key from Web3Auth provider')
    }

    const cleanHexKey = privKey.startsWith('0x') ? privKey.slice(2) : privKey
    const privateKeyBytes = new Uint8Array(Buffer.from(cleanHexKey, 'hex'))
    const ed25519SecretKey = privateKeyBytes.slice(0, 32)
    const mnemonic = algosdk.secretKeyToMnemonic(ed25519SecretKey)
    const accountFromMnemonic = algosdk.mnemonicToSecretKey(mnemonic)

    return {
      address: accountFromMnemonic.addr,
      mnemonic: mnemonic,
      secretKey: accountFromMnemonic.sk,
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to derive Algorand account from Web3Auth: ${error.message}`)
    }
    throw error
  }
}

export function createAlgorandSigner(secretKey: Uint8Array) {
  return async (transactions: Uint8Array[]): Promise<Uint8Array[]> => {
    const signedTxns: Uint8Array[] = []

    for (const txn of transactions) {
      try {
        const signedTxn = algosdk.signTransaction(txn, secretKey)
        signedTxns.push(signedTxn.blob)
      } catch (error) {
        throw new Error(`Failed to sign transaction: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    return signedTxns
  }
}

export function isValidAlgorandAddress(address: string): boolean {
  if (!address || typeof address !== 'string') {
    return false
  }

  try {
    algosdk.decodeAddress(address)
    return true
  } catch {
    return false
  }
}

export function getPublicKeyFromSecretKey(secretKey: Uint8Array): Uint8Array {
  if (secretKey.length !== 64) {
    throw new Error(`Invalid secret key length: expected 64 bytes, got ${secretKey.length}`)
  }

  return secretKey.slice(32)
}
