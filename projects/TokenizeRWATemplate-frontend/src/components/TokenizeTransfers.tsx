// TokenizeTransfers.tsx
import type { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { microAlgos } from '@algorandfoundation/algokit-utils'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AiOutlineInfoCircle, AiOutlineLoading3Quarters } from 'react-icons/ai'
import type { CreatedAsset } from './TokenizeAssetMint'

const LORA_BASE = 'https://lora.algokit.io/testnet'

// Circle USDC on Algorand TestNet (ASA)
const TESTNET_USDC_ASSET_ID = 10458941
const USDC_DECIMALS = 6
const ALGO_DECIMALS = 6

type TransferMode = 'manual' | 'algo' | 'usdc'

/**
 * Tri-state for USDC opt-in status
 * - 'loading': blockchain query in progress, UI should show spinner/loading
 * - 'opted-in': confirmed on-chain that user has opted in
 * - 'not-opted-in': confirmed on-chain that user has NOT opted in
 */
type UsdcStatus = 'loading' | 'opted-in' | 'not-opted-in'

/**
 * Convert a decimal string (e.g. "1.23") into base units bigint given decimals.
 * - Supports up to `decimals` fractional digits.
 * - Rejects negatives and invalid formats.
 */
function decimalToBaseUnits(value: string, decimals: number): bigint {
  const v = value.trim()
  if (!v) throw new Error('Amount is required')

  if (!/^\d+(\.\d+)?$/.test(v)) throw new Error('Invalid amount format')

  const [wholeRaw, fracRaw = ''] = v.split('.')
  const whole = wholeRaw || '0'
  const frac = fracRaw || ''

  if (frac.length > decimals) {
    throw new Error(`Too many decimal places (max ${decimals})`)
  }

  const fracPadded = frac.padEnd(decimals, '0')
  const combined = `${whole}${fracPadded}`.replace(/^0+(?=\d)/, '')
  return BigInt(combined || '0')
}

type Props = {
  algorand: AlgorandClient
  activeAddress: string | undefined
  signer: any
  enqueueSnackbar: (message: string, options?: any) => void

  // ✅ make optional so we never crash if a page forgets to pass it
  createdAssets?: CreatedAsset[]

  // When Mint/NFT want to prefill Transfer
  prefillAssetId: string
  prefillTrigger: number
}

export default function TokenizeTransfers({
  algorand,
  activeAddress,
  signer,
  enqueueSnackbar,
  createdAssets,
  prefillAssetId,
  prefillTrigger,
}: Props) {
  // ✅ normalize for safe .length / [0] usage
  const safeCreatedAssets = useMemo(() => createdAssets ?? [], [createdAssets])

  // ===== Transfer state =====
  const [transferMode, setTransferMode] = useState<TransferMode>('manual')
  const [transferAssetId, setTransferAssetId] = useState<string>('')
  const [receiverAddress, setReceiverAddress] = useState<string>('')
  const [transferAmount, setTransferAmount] = useState<string>('1')
  const [transferLoading, setTransferLoading] = useState<boolean>(false)

  // ===== USDC opt-in state =====
  const [usdcStatus, setUsdcStatus] = useState<UsdcStatus>('loading')
  const [usdcBalance, setUsdcBalance] = useState<bigint>(0n)
  const [usdcOptInLoading, setUsdcOptInLoading] = useState<boolean>(false)

  const [hasCheckedUsdcOnChain, setHasCheckedUsdcOnChain] = useState<boolean>(false)

  // Refs to prevent circular dependencies and duplicate operations
  const hasShownUsdcWarningRef = useRef<boolean>(false)
  const lastTransferModeRef = useRef<TransferMode>('manual')
  const isCheckingUsdcRef = useRef<boolean>(false)
  const hasCheckedUsdcOnChainRef = useRef<boolean>(false)

  const usdcOptedIn = usdcStatus === 'opted-in'
  const usdcStatusLoading = usdcStatus === 'loading'

  // Apply prefill from parent (copy button / NFT mint success)
  useEffect(() => {
    if (!prefillTrigger) return
    if (!prefillAssetId) return

    setTransferMode('manual')
    setTransferAssetId(prefillAssetId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillTrigger])

  /**
   * Fetch USDC opt-in status from blockchain
   * Uses asset-specific API for reliable opt-in detection
   * Falls back to account information API if needed
   */
  const checkUsdcOptInStatus = useCallback(async () => {
    if (!activeAddress) {
      setUsdcStatus('not-opted-in')
      setUsdcBalance(0n)
      setHasCheckedUsdcOnChain(false)
      hasCheckedUsdcOnChainRef.current = false
      isCheckingUsdcRef.current = false
      return
    }

    if (isCheckingUsdcRef.current) return
    isCheckingUsdcRef.current = true

    if (!hasCheckedUsdcOnChainRef.current) {
      setUsdcStatus('loading')
    }

    try {
      let holding: any = null
      let apiCallSucceeded = false

      try {
        holding = await algorand.asset.getAccountInformation(activeAddress, BigInt(TESTNET_USDC_ASSET_ID))
        apiCallSucceeded = true
      } catch (assetApiError: unknown) {
        const error = assetApiError as any
        const isNotFoundError =
          error?.message?.includes('not found') ||
          error?.message?.includes('404') ||
          error?.status === 404 ||
          error?.response?.status === 404

        if (isNotFoundError) {
          setUsdcStatus('not-opted-in')
          setUsdcBalance(0n)
          setHasCheckedUsdcOnChain(true)
          hasCheckedUsdcOnChainRef.current = true
          return
        }
      }

      if (apiCallSucceeded && holding) {
        const holdingAny = holding as any
        const amount = holdingAny?.amount ?? holdingAny?.balance ?? 0
        const balance = typeof amount === 'bigint' ? amount : BigInt(amount ?? 0)

        setUsdcStatus('opted-in')
        setUsdcBalance(balance)
        setHasCheckedUsdcOnChain(true)
        hasCheckedUsdcOnChainRef.current = true
        return
      }

      const info = await algorand.client.algod.accountInformation(activeAddress).do()
      const assets: any[] = info?.assets ?? []

      // NOTE: accountInformation uses "asset-id" (number) in raw algod response
      const usdcHolding = assets.find((a: any) => BigInt(a['asset-id'] ?? a.assetId) === BigInt(TESTNET_USDC_ASSET_ID))

      if (usdcHolding) {
        const balance = BigInt(usdcHolding.amount ?? 0)
        setUsdcStatus('opted-in')
        setUsdcBalance(balance)
      } else {
        setUsdcStatus('not-opted-in')
        setUsdcBalance(0n)
      }

      setHasCheckedUsdcOnChain(true)
      hasCheckedUsdcOnChainRef.current = true
    } catch (e) {
      setUsdcStatus('not-opted-in')
      setUsdcBalance(0n)
      setHasCheckedUsdcOnChain(false)
      hasCheckedUsdcOnChainRef.current = false
    } finally {
      isCheckingUsdcRef.current = false
    }
  }, [activeAddress, algorand])

  // Effect: Check USDC status when address changes or on mount
  useEffect(() => {
    setHasCheckedUsdcOnChain(false)
    hasCheckedUsdcOnChainRef.current = false
    hasShownUsdcWarningRef.current = false
    isCheckingUsdcRef.current = false

    if (!activeAddress) {
      setUsdcStatus('not-opted-in')
      setUsdcBalance(0n)
      return
    }

    setUsdcStatus('loading')

    const timeoutId = setTimeout(() => {
      checkUsdcOptInStatus()
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [activeAddress, checkUsdcOptInStatus])

  // Prefill transfer asset id from latest created asset (QoL) — only in manual mode
  useEffect(() => {
    if (transferMode !== 'manual') return
    if (!transferAssetId && safeCreatedAssets.length > 0) {
      setTransferAssetId(String(safeCreatedAssets[0].assetId))
    }
  }, [safeCreatedAssets, transferAssetId, transferMode])

  // Effect: Handle transfer mode changes and show warnings
  useEffect(() => {
    const prevMode = lastTransferModeRef.current
    const modeChanged = prevMode !== transferMode
    lastTransferModeRef.current = transferMode

    if (transferMode === 'algo') {
      setTransferAssetId('ALGO')
    } else if (transferMode === 'usdc') {
      setTransferAssetId(String(TESTNET_USDC_ASSET_ID))

      if (modeChanged && hasCheckedUsdcOnChain && !hasShownUsdcWarningRef.current && usdcStatus === 'not-opted-in') {
        enqueueSnackbar('You are not opted in to USDC yet. Please opt in before receiving or sending USDC.', { variant: 'info' })
        hasShownUsdcWarningRef.current = true
      } else if (
        modeChanged &&
        hasCheckedUsdcOnChain &&
        !hasShownUsdcWarningRef.current &&
        usdcStatus === 'opted-in' &&
        usdcBalance === 0n
      ) {
        enqueueSnackbar('Heads up: you have 0 USDC to send.', { variant: 'info' })
        hasShownUsdcWarningRef.current = true
      }
    } else {
      if (transferAssetId === 'ALGO' || transferAssetId === String(TESTNET_USDC_ASSET_ID)) {
        setTransferAssetId('')
      }
      if (!transferAssetId && safeCreatedAssets.length > 0) {
        setTransferAssetId(String(safeCreatedAssets[0].assetId))
      }
    }

    if (prevMode === 'usdc' && transferMode !== 'usdc') {
      hasShownUsdcWarningRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transferMode, hasCheckedUsdcOnChain, enqueueSnackbar, safeCreatedAssets, transferAssetId, usdcStatus, usdcBalance])

  /**
   * Opt-in to TestNet USDC
   * Opt-in is an asset transfer of 0 USDC to self
   */
  const handleOptInUsdc = async () => {
    if (!activeAddress) {
      enqueueSnackbar('Please connect a wallet or continue with Google first.', { variant: 'warning' })
      return
    }

    if (!signer) {
      enqueueSnackbar('Wallet signer not available. Please try reconnecting your wallet.', { variant: 'error' })
      return
    }

    if (usdcOptedIn) {
      enqueueSnackbar('You are already opted in to USDC ✅', { variant: 'info' })
      return
    }

    try {
      setUsdcOptInLoading(true)
      enqueueSnackbar('Opting into USDC...', { variant: 'info' })

      const result = await algorand.send.assetTransfer({
        sender: activeAddress,
        signer,
        assetId: BigInt(TESTNET_USDC_ASSET_ID),
        receiver: activeAddress,
        amount: 0n,
      })

      const txId = (result as { txId?: string }).txId

      // ✅ keep optimistic UI update, but always re-check after
      setUsdcStatus('opted-in')
      setUsdcBalance(0n)
      setHasCheckedUsdcOnChain(true)
      hasCheckedUsdcOnChainRef.current = true
      hasShownUsdcWarningRef.current = true

      enqueueSnackbar('✅ USDC opted in!', {
        variant: 'success',
        action: () =>
          txId ? (
            <a
              href={`${LORA_BASE}/transaction/${txId}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: 'underline', marginLeft: 8 }}
            >
              View Tx on Lora ↗
            </a>
          ) : null,
      })

      setTimeout(() => {
        checkUsdcOptInStatus()
      }, 1200)
    } catch (e) {
      enqueueSnackbar('USDC opt-in failed.', { variant: 'error' })
    } finally {
      setUsdcOptInLoading(false)
    }
  }

  const isWholeNumber = (v: string) => /^\d+$/.test(v)

  /**
   * Transfer assets (Manual ASA / USDC ASA / ALGO payment)
   * Handles validation, amount conversion, and transaction submission
   */
  const handleTransferAsset = async () => {
    if (!activeAddress) {
      enqueueSnackbar('Please connect a wallet or continue with Google first.', { variant: 'warning' })
      return
    }

    if (!signer) {
      enqueueSnackbar('Wallet signer not available. Please try reconnecting your wallet.', { variant: 'error' })
      return
    }

    const trimmedReceiver = receiverAddress.trim()
    const trimmedAmount = transferAmount.trim()
    const trimmedAssetId = transferAssetId.trim()

    if (!trimmedReceiver) {
      enqueueSnackbar('Please enter a recipient address.', { variant: 'warning' })
      return
    }

    if (!trimmedAmount || Number(trimmedAmount) <= 0) {
      enqueueSnackbar('Please enter an amount greater than 0.', { variant: 'warning' })
      return
    }

    if (transferMode === 'manual') {
      if (!trimmedAssetId || !isWholeNumber(trimmedAssetId)) {
        enqueueSnackbar('Please enter a valid Asset ID (number).', { variant: 'warning' })
        return
      }
      if (!isWholeNumber(trimmedAmount)) {
        enqueueSnackbar('Amount must be a whole number for manual ASA transfers.', { variant: 'warning' })
        return
      }
    }

    if (transferMode === 'algo' || transferMode === 'usdc') {
      if (!/^\d+(\.\d+)?$/.test(trimmedAmount)) {
        enqueueSnackbar('Amount must be a valid number (decimals allowed).', { variant: 'warning' })
        return
      }
    }

    if (transferMode === 'usdc' && hasCheckedUsdcOnChain && !usdcOptedIn) {
      enqueueSnackbar('You must opt-in to USDC before you can send/receive it.', { variant: 'warning' })
      return
    }

    try {
      setTransferLoading(true)

      if (transferMode === 'algo') {
        enqueueSnackbar('Sending ALGO...', { variant: 'info' })

        const result = await algorand.send.payment({
          sender: activeAddress,
          signer,
          receiver: trimmedReceiver,
          amount: microAlgos(decimalToBaseUnits(trimmedAmount, ALGO_DECIMALS)),
        })

        const txId = (result as { txId?: string }).txId

        enqueueSnackbar('✅ ALGO sent!', {
          variant: 'success',
          action: () =>
            txId ? (
              <a
                href={`${LORA_BASE}/transaction/${txId}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'underline', marginLeft: 8 }}
              >
                View Tx on Lora ↗
              </a>
            ) : null,
        })
      } else if (transferMode === 'usdc') {
        if (hasCheckedUsdcOnChain && !usdcOptedIn) {
          enqueueSnackbar('You are not opted in to USDC yet. Please opt in first.', { variant: 'warning' })
          return
        }

        if (usdcBalance === 0n) {
          enqueueSnackbar('You have 0 USDC to send.', { variant: 'warning' })
          return
        }

        enqueueSnackbar('Sending USDC...', { variant: 'info' })
        const usdcAmount = decimalToBaseUnits(trimmedAmount, USDC_DECIMALS)

        if (usdcAmount > usdcBalance) {
          enqueueSnackbar('Insufficient USDC balance for this transfer.', { variant: 'warning' })
          return
        }

        const result = await algorand.send.assetTransfer({
          sender: activeAddress,
          signer,
          assetId: BigInt(TESTNET_USDC_ASSET_ID),
          receiver: trimmedReceiver,
          amount: usdcAmount,
        })

        const txId = (result as { txId?: string }).txId

        enqueueSnackbar('✅ USDC transfer complete!', {
          variant: 'success',
          action: () =>
            txId ? (
              <a
                href={`${LORA_BASE}/transaction/${txId}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'underline', marginLeft: 8 }}
              >
                View Tx on Lora ↗
              </a>
            ) : null,
        })

        setTimeout(() => {
          checkUsdcOptInStatus()
        }, 1200)
      } else {
        enqueueSnackbar('Transferring asset...', { variant: 'info' })

        const result = await algorand.send.assetTransfer({
          sender: activeAddress,
          signer,
          assetId: BigInt(trimmedAssetId),
          receiver: trimmedReceiver,
          amount: BigInt(trimmedAmount),
        })

        const txId = (result as { txId?: string }).txId

        enqueueSnackbar('✅ Transfer complete!', {
          variant: 'success',
          action: () =>
            txId ? (
              <a
                href={`${LORA_BASE}/transaction/${txId}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'underline', marginLeft: 8 }}
              >
                View Tx on Lora ↗
              </a>
            ) : null,
        })
      }

      setReceiverAddress('')
      setTransferAmount('1')
    } catch (error) {
      if (transferMode === 'algo') {
        enqueueSnackbar('ALGO send failed.', { variant: 'error' })
      } else {
        enqueueSnackbar('Transfer failed. If sending an ASA (incl. USDC), make sure the recipient has opted in.', { variant: 'error' })
      }
    } finally {
      setTransferLoading(false)
    }
  }

  const transferAmountLabel = useMemo(
    () => (transferMode === 'algo' ? 'Amount (ALGO)' : transferMode === 'usdc' ? 'Amount (USDC)' : 'Amount'),
    [transferMode],
  )
  const transferAssetIdLabel = useMemo(
    () => (transferMode === 'algo' ? 'Asset (ALGO)' : transferMode === 'usdc' ? 'Asset (USDC)' : 'Asset ID'),
    [transferMode],
  )

  // Determine if transfer button should be enabled
  const canTransfer = useMemo(() => {
    if (!activeAddress || transferLoading) {
      return false
    }

    const trimmedReceiver = receiverAddress.trim()
    const trimmedAmount = transferAmount.trim()
    const trimmedAssetId = transferAssetId.trim()

    if (!trimmedReceiver) {
      return false
    }
    if (!trimmedAmount || Number(trimmedAmount) <= 0) {
      return false
    }

    if (transferMode === 'manual') {
      if (!trimmedAssetId || !isWholeNumber(trimmedAssetId)) {
        return false
      }
      if (!isWholeNumber(trimmedAmount)) {
        return false
      }
    }

    if (transferMode === 'algo' || transferMode === 'usdc') {
      if (!/^\d+(\.\d+)?$/.test(trimmedAmount)) {
        return false
      }
    }

    if (transferMode === 'usdc' && hasCheckedUsdcOnChain && !usdcOptedIn) {
      return false
    }

    return true
  }, [activeAddress, transferLoading, receiverAddress, transferAmount, transferAssetId, transferMode, hasCheckedUsdcOnChain, usdcOptedIn])

  const renderUsdcStatusText = () => {
    if (usdcStatusLoading) return <span className="text-slate-500 dark:text-slate-400">Checking status...</span>
    if (usdcOptedIn) {
      return (
        <span className="text-teal-700 dark:text-teal-300">
          Already opted in ✅{' '}
          <span className="text-slate-500 dark:text-slate-400 font-mono">
            ({(Number(usdcBalance) / 10 ** USDC_DECIMALS).toFixed(2)} USDC)
          </span>
        </span>
      )
    }
    return <span className="text-slate-600 dark:text-slate-300">Required before you can receive TestNet USDC.</span>
  }

  const renderOptInButtonText = () => {
    if (usdcOptInLoading) {
      return (
        <span className="flex items-center gap-2">
          <AiOutlineLoading3Quarters className="animate-spin" />
          Opting in…
        </span>
      )
    }
    if (usdcStatusLoading) {
      return (
        <span className="flex items-center gap-2">
          <AiOutlineLoading3Quarters className="animate-spin" />
          Checking…
        </span>
      )
    }
    if (usdcOptedIn) return 'USDC opted in ✅'
    return 'Opt in USDC'
  }

  return (
    <div className="mt-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg p-6 sm:p-8">
      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Transfer</h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">Send ALGO, USDC, or any ASA (including NFTs) to another wallet.</p>

      {/* USDC Opt-in */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-4">
        <div className="text-sm text-slate-700 dark:text-slate-200">
          <span className="font-semibold">USDC Opt-In:</span> {renderUsdcStatusText()}
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Asset ID: <span className="font-mono">{TESTNET_USDC_ASSET_ID}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOptInUsdc}
          disabled={!activeAddress || usdcOptedIn || usdcOptInLoading || usdcStatusLoading}
          className={`inline-flex items-center justify-center px-4 py-2 rounded-lg font-semibold transition ${
            !activeAddress || usdcOptedIn || usdcOptInLoading || usdcStatusLoading
              ? 'bg-slate-300 text-slate-500 cursor-not-allowed dark:bg-slate-700 dark:text-slate-400'
              : 'bg-teal-600 hover:bg-teal-700 text-white shadow-md'
          }`}
        >
          {renderOptInButtonText()}
        </button>
      </div>

      {/* TestNet USDC helper */}
      <div className="mb-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm text-slate-700 dark:text-slate-200">
            Need TestNet USDC? Use Circle&apos;s faucet, then transfer it like any ASA.
            <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1">
              Note: you may need to opt-in to the USDC asset before receiving it.
            </span>
          </div>

          <a
            href="https://faucet.circle.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg font-semibold bg-teal-600 hover:bg-teal-700 text-white shadow-md transition"
          >
            Open USDC Faucet ↗
          </a>
        </div>
      </div>

      {/* Mode selector */}
      <div className="mb-5">
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Transfer type</label>
        <div className="flex flex-col sm:flex-row gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="radio"
              name="transferMode"
              checked={transferMode === 'manual'}
              onChange={() => setTransferMode('manual')}
              className="h-4 w-4"
            />
            Manual (custom ASA)
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="radio"
              name="transferMode"
              checked={transferMode === 'algo'}
              onChange={() => setTransferMode('algo')}
              className="h-4 w-4"
            />
            ALGO
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="radio"
              name="transferMode"
              checked={transferMode === 'usdc'}
              onChange={() => setTransferMode('usdc')}
              className="h-4 w-4"
            />
            USDC (TestNet)
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{transferAssetIdLabel}</label>
          <input
            type="text"
            className="w-full rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-300 dark:border-slate-600 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 dark:focus:ring-teal-900/30 px-4 py-2 transition"
            placeholder="e.g. 123456789"
            value={transferAssetId}
            onChange={(e) => setTransferAssetId(e.target.value)}
            disabled={transferMode === 'algo' || transferMode === 'usdc'}
          />
          {transferMode === 'usdc' && (
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              USDC TestNet Asset ID: <span className="font-mono">{TESTNET_USDC_ASSET_ID}</span>
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Recipient Address</label>
          <input
            type="text"
            className="w-full rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-300 dark:border-slate-600 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 dark:focus:ring-teal-900/30 px-4 py-2 transition"
            placeholder="Wallet address"
            value={receiverAddress}
            onChange={(e) => setReceiverAddress(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">{transferAmountLabel}</label>
          <input
            type="text"
            inputMode="decimal"
            className="w-full rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-300 dark:border-slate-600 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 dark:focus:ring-teal-900/30 px-4 py-2 transition"
            value={transferAmount}
            onChange={(e) => setTransferAmount(e.target.value)}
            placeholder={transferMode === 'manual' ? 'e.g. 1' : 'e.g. 1.5'}
          />
          {transferMode === 'manual' && (
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Manual ASA transfers use whole-number amounts.</p>
          )}
          {(transferMode === 'algo' || transferMode === 'usdc') && (
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Decimals allowed (up to 6 places).</p>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:justify-end">
        <button
          type="button"
          onClick={handleTransferAsset}
          disabled={!canTransfer}
          className={`px-6 py-3 rounded-lg font-semibold transition ${
            canTransfer
              ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-md'
              : 'bg-slate-300 text-slate-500 cursor-not-allowed dark:bg-slate-700 dark:text-slate-400'
          }`}
        >
          {transferLoading
            ? 'Transferring…'
            : transferMode === 'algo'
              ? 'Send ALGO'
              : transferMode === 'usdc'
                ? 'Send USDC'
                : 'Transfer Asset'}
        </button>
      </div>

      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
        <AiOutlineInfoCircle />
        {transferMode === 'algo'
          ? 'ALGO payments do not require opt-in.'
          : 'For ASAs (including USDC and NFTs), the recipient must opt-in to the asset before receiving it.'}
      </p>
    </div>
  )
}
