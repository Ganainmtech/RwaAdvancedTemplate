import type { AlgorandClient } from '@algorandfoundation/algokit-utils'
import { sha512_256 } from 'js-sha512'
import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { AiOutlineCloudUpload, AiOutlineInfoCircle, AiOutlineLoading3Quarters } from 'react-icons/ai'
import type { CreatedAsset } from './TokenizeAssetMint'

const LORA_BASE = 'https://lora.algokit.io/testnet'
const NFT_STORAGE_KEY = 'tokenize_nfts'

function loadNfts(): CreatedAsset[] {
  try {
    const raw = localStorage.getItem(NFT_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as CreatedAsset[]) : []
  } catch {
    return []
  }
}

function persistNft(asset: CreatedAsset): CreatedAsset[] {
  const existing = loadNfts()
  const next = [asset, ...existing]
  localStorage.setItem(NFT_STORAGE_KEY, JSON.stringify(next))
  return next
}

function resolveBackendBase(): string {
  // 1) Respect explicit env (Vercel or custom)
  const env = import.meta.env.VITE_API_URL?.trim()
  if (env) {
    const cleaned = env.replace(/\/$/, '')
    // If someone pastes "my-backend.vercel.app" (no protocol),
    // the browser will treat it as a relative path. Force https.
    return cleaned.startsWith('http://') || cleaned.startsWith('https://') ? cleaned : `https://${cleaned}`
  }

  // 2) Codespaces: convert current host to port 3001
  // e.g. https://abc-5173.app.github.dev -> https://abc-3001.app.github.dev
  const host = window.location.host
  if (host.endsWith('.app.github.dev')) {
    const base = host.replace(/-\d+\.app\.github\.dev$/, '-3001.app.github.dev')
    return `https://${base}`
  }

  // 3) Plain local fallback
  return 'http://localhost:3001'
}

type Props = {
  algorand: AlgorandClient
  activeAddress: string | undefined
  signer: any
  enqueueSnackbar: (message: string, options?: any) => void

  onAssetCreated: (asset: CreatedAsset) => void
  onPrefillTransferAsset: (assetId: string) => void
}

export default function TokenizeNftMint({
  algorand,
  activeAddress,
  signer,
  enqueueSnackbar,
  onAssetCreated,
  onPrefillTransferAsset,
}: Props) {
  // ===== NFT storage state =====
  const [createdNfts, setCreatedNfts] = useState<CreatedAsset[]>([])
  const safeCreatedNfts = useMemo(() => createdNfts ?? [], [createdNfts])

  useEffect(() => {
    setCreatedNfts(loadNfts())
  }, [])

  const onNftCreated = (asset: CreatedAsset) => {
    const next = persistNft(asset)
    setCreatedNfts(next)
    onAssetCreated(asset)
  }

  const onClearNfts = () => {
    localStorage.removeItem(NFT_STORAGE_KEY)
    setCreatedNfts([])
  }

  // ===== NFT mint state =====
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [nftLoading, setNftLoading] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // NFT mint configurable fields
  const [nftName, setNftName] = useState<string>('MasterPass Ticket')
  const [nftUnit, setNftUnit] = useState<string>('MTK')
  const [nftSupply, setNftSupply] = useState<string>('1')
  const [nftDecimals, setNftDecimals] = useState<string>('0')
  const [nftDefaultFrozen, setNftDefaultFrozen] = useState<boolean>(false)

  // NFT advanced (addresses)
  const [nftShowAdvanced, setNftShowAdvanced] = useState<boolean>(false)
  const [nftManager, setNftManager] = useState<string>('')
  const [nftReserve, setNftReserve] = useState<string>('')
  const [nftFreeze, setNftFreeze] = useState<string>('')
  const [nftClawback, setNftClawback] = useState<string>('')

  // NFT: default manager to connected address (same UX as ASA)
  useEffect(() => {
    if (activeAddress && !nftManager) setNftManager(activeAddress)
  }, [activeAddress, nftManager])

  const resetNftDefaults = () => {
    setSelectedFile(null)
    setPreviewUrl('')
    if (fileInputRef.current) fileInputRef.current.value = ''

    setNftName('MasterPass Ticket')
    setNftUnit('MTK')
    setNftSupply('1')
    setNftDecimals('0')
    setNftDefaultFrozen(false)

    setNftShowAdvanced(false)
    setNftManager(activeAddress ?? '')
    setNftReserve('')
    setNftFreeze('')
    setNftClawback('')
  }

  const isWholeNumber = (v: string) => /^\d+$/.test(v)

  /**
   * NFT mint helpers
   */
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setSelectedFile(file)
    setPreviewUrl(file ? URL.createObjectURL(file) : '')
  }

  const handleDivClick = () => fileInputRef.current?.click()

  const handleMintNFT = async () => {
    if (!activeAddress) {
      enqueueSnackbar('Please connect a wallet or continue with Google first.', { variant: 'warning' })
      return
    }

    if (!signer) {
      enqueueSnackbar('Wallet signer not available. Please try reconnecting your wallet.', { variant: 'error' })
      return
    }

    if (!selectedFile) {
      enqueueSnackbar('Please select an image file to mint.', { variant: 'warning' })
      return
    }

    // Validate NFT fields
    if (!nftName || !nftUnit) {
      enqueueSnackbar('Please enter an NFT name and unit/symbol.', { variant: 'warning' })
      return
    }
    if (!nftSupply || !isWholeNumber(nftSupply)) {
      enqueueSnackbar('Supply must be a whole number.', { variant: 'warning' })
      return
    }
    if (!nftDecimals || !isWholeNumber(nftDecimals)) {
      enqueueSnackbar('Decimals must be a whole number (0–19).', { variant: 'warning' })
      return
    }

    const d = Number(nftDecimals)
    if (Number.isNaN(d) || d < 0 || d > 19) {
      enqueueSnackbar('NFT decimals must be between 0 and 19.', { variant: 'warning' })
      return
    }

    setNftLoading(true)
    enqueueSnackbar('Uploading and preparing NFT...', { variant: 'info' })

    let metadataUrl = ''
    try {
      const backendBase = resolveBackendBase()
      const backendApiUrl = `${backendBase.replace(/\/$/, '')}/api/pin-image`

      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch(backendApiUrl, {
        method: 'POST',
        body: formData,
        mode: 'cors',
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Backend request failed: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      metadataUrl = data.metadataUrl
      if (!metadataUrl) throw new Error('Backend did not return a valid metadata URL')
    } catch (e: any) {
      enqueueSnackbar('Error uploading to backend. If in Codespaces, make port 3001 Public.', { variant: 'error' })
      setNftLoading(false)
      return
    }

    try {
      enqueueSnackbar('Minting NFT on Algorand...', { variant: 'info' })

      // Demo shortcut: hash the metadata URL string (ARC-3 would hash JSON bytes)
      const metadataHash = Uint8Array.from(sha512_256.digest(metadataUrl))

      const onChainTotal = BigInt(nftSupply) * 10n ** BigInt(d)

      const createNFTResult = await algorand.send.assetCreate({
        sender: activeAddress,
        signer,
        total: onChainTotal,
        decimals: d,
        assetName: nftName,
        unitName: nftUnit,
        url: metadataUrl,
        metadataHash,
        defaultFrozen: nftDefaultFrozen,
        manager: nftManager || undefined,
        reserve: nftReserve || undefined,
        freeze: nftFreeze || undefined,
        clawback: nftClawback || undefined,
      })

      const assetId = createNFTResult.assetId

      const nftEntry: CreatedAsset = {
        assetId: String(assetId),
        assetName: String(nftName),
        unitName: String(nftUnit),
        total: String(nftSupply),
        decimals: String(nftDecimals),
        url: metadataUrl ? String(metadataUrl) : undefined,
        manager: nftManager ? String(nftManager) : undefined,
        reserve: nftReserve ? String(nftReserve) : undefined,
        freeze: nftFreeze ? String(nftFreeze) : undefined,
        clawback: nftClawback ? String(nftClawback) : undefined,
        createdAt: new Date().toISOString(),
      }

      onNftCreated(nftEntry)

      // Keep behavior: prefill Transfer with minted asset id
      onPrefillTransferAsset(String(assetId))

      enqueueSnackbar(`✅ Success! NFT Asset ID: ${assetId}`, {
        variant: 'success',
        action: () =>
          assetId ? (
            <a
              href={`${LORA_BASE}/asset/${assetId}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: 'underline', marginLeft: 8 }}
            >
              View on Lora ↗
            </a>
          ) : null,
      })

      // Reset just the file picker + preview (keep fields, so they can mint many quickly)
      setSelectedFile(null)
      setPreviewUrl('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (e: any) {
      enqueueSnackbar(`Failed to mint NFT: ${e?.message || 'Unknown error'}`, { variant: 'error' })
    } finally {
      setNftLoading(false)
    }
  }

  const canMintNft = !!nftName && !!nftUnit && !!nftSupply && !!nftDecimals && !!selectedFile && !!activeAddress && !nftLoading

  return (
    <div className={`${nftLoading ? 'opacity-90' : ''}`}>
      <div className="mb-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Tokenize an NFT (Mint ASA)</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Upload an image → backend pins to IPFS → mint an ASA with metadata.
        </p>
      </div>

      <div
        className={`rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm p-5 sm:p-6 ${
          nftLoading ? 'pointer-events-none opacity-70' : ''
        }`}
      >
        {/* NFT fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Name</label>
            <input
              type="text"
              className="w-full rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-300 dark:border-slate-600 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 dark:focus:ring-teal-900/30 px-4 py-2 transition"
              value={nftName}
              onChange={(e) => setNftName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Unit / Symbol</label>
            <input
              type="text"
              className="w-full rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-300 dark:border-slate-600 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 dark:focus:ring-teal-900/30 px-4 py-2 transition"
              value={nftUnit}
              onChange={(e) => setNftUnit(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Supply</label>
            <input
              type="number"
              min={1}
              className="w-full rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-300 dark:border-slate-600 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 dark:focus:ring-teal-900/30 px-4 py-2 transition"
              value={nftSupply}
              onChange={(e) => setNftSupply(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">For a true 1/1 NFT, set supply = 1.</p>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              <span>Decimals</span>
              <div className="group relative">
                <AiOutlineInfoCircle className="text-slate-400 cursor-help hover:text-slate-600 dark:hover:text-slate-300" />
                <div className="invisible group-hover:visible bg-slate-900 dark:bg-slate-800 text-white dark:text-slate-200 text-xs rounded px-2 py-1 whitespace-nowrap absolute bottom-full left-0 mb-1 z-10">
                  Decimals controls fractional units. For a typical NFT, use 0.
                </div>
              </div>
            </label>
            <input
              type="number"
              min={0}
              max={19}
              className="w-full rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-300 dark:border-slate-600 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 dark:focus:ring-teal-900/30 px-4 py-2 transition"
              value={nftDecimals}
              onChange={(e) => setNftDecimals(e.target.value)}
            />
          </div>

          <div className="md:col-span-2">
            <label className="flex items-center gap-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={nftDefaultFrozen}
                onChange={(e) => setNftDefaultFrozen(e.target.checked)}
                className="h-4 w-4 rounded border border-slate-300 dark:border-slate-600"
              />
              <span>Default Frozen</span>
              <div className="group relative">
                <AiOutlineInfoCircle className="text-slate-400 cursor-help hover:text-slate-600 dark:hover:text-slate-300" />
                <div className="invisible group-hover:visible bg-slate-900 dark:bg-slate-800 text-white dark:text-slate-200 text-xs rounded px-2 py-1 whitespace-nowrap absolute bottom-full left-0 mb-1 z-10">
                  If enabled, new holdings start frozen until unfrozen by the Freeze account.
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* NFT advanced options toggle */}
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setNftShowAdvanced((s) => !s)}
            className="flex items-center gap-2 text-sm font-medium text-primary hover:underline transition"
          >
            <span>{nftShowAdvanced ? 'Hide advanced options' : 'Show advanced options'}</span>
            <span className={`transition-transform ${nftShowAdvanced ? 'rotate-180' : ''}`}>▾</span>
          </button>

          {nftShowAdvanced && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-5">
              {[
                {
                  label: 'Manager',
                  tip: 'Manager can update or reconfigure asset settings. Often set to the issuer wallet.',
                  value: nftManager,
                  setValue: setNftManager,
                  placeholder: 'Defaults to your wallet address',
                },
                {
                  label: 'Reserve',
                  tip: 'Reserve can hold non-circulating supply depending on design. Leave blank to disable.',
                  value: nftReserve,
                  setValue: setNftReserve,
                  placeholder: 'Optional address',
                },
                {
                  label: 'Freeze',
                  tip: 'Freeze can freeze/unfreeze holdings (useful for compliance). Leave blank to disable.',
                  value: nftFreeze,
                  setValue: setNftFreeze,
                  placeholder: 'Optional address',
                },
                {
                  label: 'Clawback',
                  tip: 'Clawback can revoke tokens from accounts (recovery/compliance). Leave blank to disable.',
                  value: nftClawback,
                  setValue: setNftClawback,
                  placeholder: 'Optional address',
                },
              ].map((f) => (
                <div key={f.label}>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    <span>{f.label}</span>
                    <div className="group relative">
                      <AiOutlineInfoCircle className="text-slate-400 cursor-help hover:text-slate-600 dark:hover:text-slate-300" />
                      <div className="invisible group-hover:visible bg-slate-900 dark:bg-slate-800 text-white dark:text-slate-200 text-xs rounded px-2 py-1 whitespace-nowrap absolute bottom-full left-0 mb-1 z-10">
                        {f.tip}
                      </div>
                    </div>
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-300 dark:border-slate-600 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 dark:focus:ring-teal-900/30 px-4 py-2 transition"
                    placeholder={f.placeholder}
                    value={f.value}
                    onChange={(e) => f.setValue(e.target.value)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Image upload */}
        <div className="mt-6">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Select an image</label>

          <div
            className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer bg-slate-50 dark:bg-slate-800/40 hover:border-teal-200 dark:hover:border-teal-700 transition-colors"
            onClick={handleDivClick}
          >
            {previewUrl ? (
              <img src={previewUrl} alt="NFT preview" className="rounded-lg max-h-48 object-contain shadow-sm bg-white dark:bg-slate-900" />
            ) : (
              <div className="text-center">
                <AiOutlineCloudUpload className="mx-auto h-12 w-12 text-slate-400" />
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">Drag and drop or click to upload</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">PNG, JPG, GIF up to 10MB</p>
              </div>
            )}

            <input
              type="file"
              ref={fileInputRef}
              className="sr-only"
              onChange={handleFileChange}
              accept="image/png, image/jpeg, image/gif"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:justify-end">
          <button
            type="button"
            className="px-6 py-3 rounded-lg font-semibold transition bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
            onClick={resetNftDefaults}
            disabled={nftLoading}
          >
            Reset
          </button>

          <button
            type="button"
            onClick={handleMintNFT}
            disabled={!canMintNft}
            className={`px-6 py-3 rounded-lg font-semibold transition ${
              canMintNft
                ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-md'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed dark:bg-slate-700 dark:text-slate-400'
            }`}
          >
            {nftLoading ? (
              <span className="flex items-center gap-2">
                <AiOutlineLoading3Quarters className="animate-spin" />
                Minting…
              </span>
            ) : (
              'Mint NFT'
            )}
          </button>
        </div>

        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
          <AiOutlineInfoCircle />
          Uses backend <span className="font-mono">/api/pin-image</span>. In Codespaces, make port 3001 Public.
        </p>
      </div>

      {/* ===== MY CREATED NFTs ===== */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">My Created NFTs</h3>
          <button
            type="button"
            className="px-3 py-1 text-xs bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition"
            onClick={onClearNfts}
          >
            Clear
          </button>
        </div>

        <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                <th className="text-left px-4 py-3 font-semibold text-slate-900 dark:text-white">Asset ID</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-900 dark:text-white">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-900 dark:text-white">Symbol</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-900 dark:text-white">Supply</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-900 dark:text-white">Decimals</th>
              </tr>
            </thead>
            <tbody>
              {safeCreatedNfts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center px-4 py-6 text-slate-500 dark:text-slate-400">
                    No NFTs created yet. Mint one to see it here.
                  </td>
                </tr>
              ) : (
                safeCreatedNfts.map((a) => (
                  <tr
                    key={`${a.assetId}-${a.createdAt}`}
                    className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition"
                    onClick={() => window.open(`${LORA_BASE}/asset/${a.assetId}`, '_blank', 'noopener,noreferrer')}
                    title="Open in Lora explorer"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-700 dark:text-slate-300">{String(a.assetId)}</span>
                        <button
                          type="button"
                          className="px-2 py-1 text-[11px] rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigator.clipboard.writeText(String(a.assetId))
                            enqueueSnackbar('NFT Asset ID copied to clipboard', { variant: 'success' })
                          }}
                          title="Copy Asset ID"
                        >
                          Copy
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-900 dark:text-white">{a.assetName}</td>
                    <td className="font-mono px-4 py-3 text-slate-700 dark:text-slate-300">{a.unitName}</td>
                    <td className="font-mono px-4 py-3 text-slate-700 dark:text-slate-300">{a.total}</td>
                    <td className="font-mono px-4 py-3 text-slate-700 dark:text-slate-300">{a.decimals}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
          <AiOutlineInfoCircle />
          This list is stored locally in your browser (localStorage) to keep the template simple.
        </p>
      </div>
    </div>
  )
}
