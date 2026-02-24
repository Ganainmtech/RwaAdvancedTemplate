// TokenizeTransferPage.tsx
import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { useWallet } from '@txnlab/use-wallet-react'
import { useSnackbar } from 'notistack'
import { useEffect, useMemo, useState } from 'react'
import type { CreatedAsset } from './components/TokenizeAssetMint' // adjust path if needed
import TokenizeTransfers from './components/TokenizeTransfers' // adjust path if needed
import { getAlgodConfigFromViteEnvironment } from './utils/network/getAlgoClientConfigs' // adjust path if needed

const STORAGE_KEY = 'tokenize_assets'

function loadAssets(): CreatedAsset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as CreatedAsset[]) : []
  } catch {
    return []
  }
}

/**
 * Tokenize Transfer Page
 * Page wrapper for sending ALGO, USDC, or any ASA
 */
export default function TokenizeTransferPage() {
  const { transactionSigner, activeAddress } = useWallet()
  const signer = transactionSigner
  const { enqueueSnackbar } = useSnackbar()

  const algodConfig = getAlgodConfigFromViteEnvironment()
  const algorand = useMemo(() => AlgorandClient.fromConfig({ algodConfig }), [algodConfig])

  const [createdAssets, setCreatedAssets] = useState<CreatedAsset[]>([])

  useEffect(() => {
    setCreatedAssets(loadAssets())
  }, [])

  // Keep these for API compatibility with TokenizeTransfers
  const [prefillAssetId] = useState<string>('')
  const [prefillTrigger] = useState<number>(0)

  return (
    <div className="bg-white dark:bg-slate-950 min-h-screen py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
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
