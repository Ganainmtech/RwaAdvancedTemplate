// TokenizeWorkspace.tsx
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { useEffect, useMemo, useState } from 'react'
import { BsCoin } from 'react-icons/bs'
import { getAlgodConfigFromViteEnvironment } from '../utils/network/getAlgoClientConfigs'
import TokenizeAssetMint, { CreatedAsset } from './TokenizeAssetMint'
import TokenizeNftMint from './TokenizeNftMint'
import TokenizeTransfers from './TokenizeTransfers'

const STORAGE_KEY = 'tokenize_assets'

function loadAssets(): CreatedAsset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as CreatedAsset[]) : []
  } catch {
    return []
  }
}

function persistAsset(asset: CreatedAsset): CreatedAsset[] {
  const existing = loadAssets()
  const next = [asset, ...existing]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

export default function TokenizeWorkspace() {
  const { transactionSigner, activeAddress } = useWallet()
  const signer = transactionSigner

  const { enqueueSnackbar } = useSnackbar()

  const algodConfig = getAlgodConfigFromViteEnvironment()
  const algorand = useMemo(() => AlgorandClient.fromConfig({ algodConfig }), [algodConfig])

  const [createdAssets, setCreatedAssets] = useState<CreatedAsset[]>([])

  useEffect(() => {
    setCreatedAssets(loadAssets())
  }, [])

  const onAssetCreated = (asset: CreatedAsset) => {
    const next = persistAsset(asset)
    setCreatedAssets(next)
  }

  // left here in case you use it elsewhere

  // Transfer prefill “signal”
  const [prefillAssetId, setPrefillAssetId] = useState<string>('')
  const [prefillTrigger, setPrefillTrigger] = useState<number>(0)

  const onPrefillTransferAsset = (assetId: string) => {
    setPrefillAssetId(assetId)
    setPrefillTrigger((n) => n + 1)
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg p-6 sm:p-8">
      {/* Top header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/30">
            <BsCoin className="text-2xl text-teal-600 dark:text-teal-400" />
          </span>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Tokenize on Algorand</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Mint standard ASAs or mint an NFT-style ASA on TestNet.</p>

            {/* TestNet funding helper */}
            <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-sm text-slate-700 dark:text-slate-200">
                  Need TestNet ALGO to get started? Use the Algorand TestNet Dispenser.
                  <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Tip: fund the connected address, then refresh your balance.
                  </span>
                </div>

                <a
                  href="https://bank.testnet.algorand.network/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg font-semibold bg-teal-600 hover:bg-teal-700 text-white shadow-md transition"
                >
                  Open Dispenser ↗
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN: 2-column panel (ASA left, NFT right) */}
      <div className="mt-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <TokenizeAssetMint
            algorand={algorand}
            activeAddress={activeAddress ?? undefined}
            signer={signer}
            enqueueSnackbar={enqueueSnackbar}
            onAssetCreated={onAssetCreated}
            onPrefillTransferAsset={onPrefillTransferAsset}
          />

          <TokenizeNftMint
            algorand={algorand}
            activeAddress={activeAddress ?? undefined}
            signer={signer}
            enqueueSnackbar={enqueueSnackbar}
            onAssetCreated={onAssetCreated}
            onPrefillTransferAsset={onPrefillTransferAsset}
          />
        </div>

        <TokenizeTransfers
          algorand={algorand}
          activeAddress={activeAddress ?? undefined}
          signer={signer}
          enqueueSnackbar={enqueueSnackbar}
          createdAssets={createdAssets}
          prefillAssetId={prefillAssetId}
          prefillTrigger={prefillTrigger}
        />
      </div>
    </div>
  )
}
