import algosdk, { TransactionSigner } from 'algosdk'
import { type AlgorandAccountFromWeb3Auth } from './algorandAdapter'

export interface AlgorandTransactionSigner {
  sign: (transactions: Uint8Array[]) => Promise<Uint8Array[]>
  sender?: string
}

export function createWeb3AuthSigner(account: AlgorandAccountFromWeb3Auth): TransactionSigner {
  const sk = account.secretKey
  const addr = account.address

  const secretKey: Uint8Array =
    sk instanceof Uint8Array
      ? sk
      : Array.isArray(sk)
        ? Uint8Array.from(sk)
        : (() => {
            throw new Error('Web3Auth secretKey is not a Uint8Array (or number[]). Cannot sign transactions.')
          })()

  return algosdk.makeBasicAccountTransactionSigner({
    addr,
    sk: secretKey,
  })
}

export function createWeb3AuthSignerObject(account: AlgorandAccountFromWeb3Auth): AlgorandTransactionSigner {
  const signerFn = createWeb3AuthSigner(account)

  const sign = async (transactions: Uint8Array[]) => {
    const txns = transactions.map((b) => algosdk.decodeUnsignedTransaction(b))
    const signed = await signerFn(txns, txns.map((_, i) => i))
    return signed
  }

  return {
    sign,
    sender: account.address,
  }
}

export function createWeb3AuthMultiSigSigner(account: AlgorandAccountFromWeb3Auth) {
  return {
    signer: createWeb3AuthSigner(account),
    sender: account.address,
    account,
  }
}

export function getWeb3AuthAccountInfo(account: AlgorandAccountFromWeb3Auth) {
  const decodedAddress = algosdk.decodeAddress(account.address)

  return {
    address: account.address,
    publicKeyBytes: decodedAddress.publicKey,
    publicKeyBase64: Buffer.from(decodedAddress.publicKey).toString('base64'),
    secretKeyHex: Buffer.from(account.secretKey).toString('hex'),
    mnemonicPhrase: account.mnemonic,
  }
}

export function verifyWeb3AuthSignature(signedTransaction: Uint8Array, account: AlgorandAccountFromWeb3Auth): boolean {
  try {
    const decodedTxn = algosdk.decodeSignedTransaction(signedTransaction)
    const txnSigner = decodedTxn.sig?.signers?.[0] ?? decodedTxn.sig?.signer

    if (!txnSigner) return false

    const decodedAddress = algosdk.decodeAddress(account.address)
    return Buffer.from(txnSigner).equals(decodedAddress.publicKey)
  } catch (error) {
    console.error('Error verifying signature:', error)
    return false
  }
}

export function analyzeTransactionGroup(transactions: Uint8Array[]) {
  return {
    count: transactions.length,
    totalSize: transactions.reduce((sum, txn) => sum + txn.length, 0),
    averageSize: transactions.reduce((sum, txn) => sum + txn.length, 0) / transactions.length,
  }
}

export function formatAmount(amount: bigint | number, decimals: number = 6): string {
  const amountStr = amount.toString()
  const decimalPoints = decimals

  if (amountStr.length <= decimalPoints) {
    return `0.${amountStr.padStart(decimalPoints, '0')}`
  }

  const integerPart = amountStr.slice(0, -decimalPoints)
  const decimalPart = amountStr.slice(-decimalPoints)

  return `${integerPart}.${decimalPart}`
}

export function parseAmount(amount: string, decimals: number = 6): bigint {
  const trimmed = amount.trim()

  if (!trimmed) {
    throw new Error('Amount is required')
  }

  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error('Invalid amount format')
  }

  const [integerPart = '0', decimalPart = ''] = trimmed.split('.')

  if (decimalPart.length > decimals) {
    throw new Error(`Too many decimal places (maximum ${decimals})`)
  }

  const paddedDecimal = decimalPart.padEnd(decimals, '0')
  const combined = integerPart + paddedDecimal
  return BigInt(combined)
}

export function hasSufficientBalance(balance: bigint, requiredAmount: bigint, minFee: bigint = BigInt(1000)): boolean {
  const totalRequired = requiredAmount + minFee
  return balance >= totalRequired
}
