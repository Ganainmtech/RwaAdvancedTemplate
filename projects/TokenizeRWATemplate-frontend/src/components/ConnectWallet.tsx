import { WalletId } from '@txnlab/use-wallet-react'
import { useEffect, useRef, useState } from 'react'
import { SocialLoginProvider, useUnifiedWallet } from '../hooks/useUnifiedWallet'
import Account from './Account'

interface ConnectWalletInterface {
  openModal: boolean
  closeModal: () => void
}

const ConnectWallet = ({ openModal, closeModal }: ConnectWalletInterface) => {
  // Destructure the new clean methods from your unified hook
  const { isConnected, walletType, userInfo, traditionalWallets, connectGoogle, connectFacebook, connectGithub, disconnect } =
    useUnifiedWallet()

  const [connectingProvider, setConnectingProvider] = useState<SocialLoginProvider | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  const handleSocialLogin = async (provider: SocialLoginProvider, connectFn: () => Promise<void>) => {
    try {
      setConnectingProvider(provider)
      await connectFn() // Bypasses the Web3Auth modal
      closeModal()
    } catch (error) {
      console.error(`${provider} login failed`, error)
    } finally {
      setConnectingProvider(null)
    }
  }

  const socialOptions: { id: SocialLoginProvider; label: string; icon: string; action: () => Promise<void> }[] = [
    {
      id: 'google',
      label: 'Continue with Google',
      icon: 'https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png',
      action: connectGoogle,
    },
    {
      id: 'facebook',
      label: 'Continue with Facebook',
      icon: 'https://www.facebook.com/images/fb_icon_325x325.png',
      action: connectFacebook,
    },
    {
      id: 'github',
      label: 'Continue with GitHub',
      icon: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
      action: connectGithub,
    },
  ]

  const formatSocialProvider = (provider?: string) => {
    const normalized = provider?.toLowerCase()
    switch (normalized) {
      case 'google':
        return 'Google'
      case 'facebook':
        return 'Facebook'
      case 'github':
        return 'GitHub'
      default:
        return 'Social Login'
    }
  }

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    openModal ? dialog.showModal() : dialog.close()
  }, [openModal])

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 w-full max-w-md mx-auto my-auto rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border-none p-0 backdrop:bg-gray-900/50 backdrop:backdrop-blur-sm"
      onClick={(e) => e.target === dialogRef.current && closeModal()}
    >
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{isConnected ? 'Account' : 'Sign in'}</h3>
          <button onClick={closeModal} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition">
            <span className="text-xl text-gray-500">✕</span>
          </button>
        </div>

        <div className="space-y-6">
          {isConnected ? (
            /* --- CONNECTED STATE --- */
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700">
                <Account />

                {walletType === 'web3auth' && userInfo && (
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center gap-3">
                    {userInfo.profileImage && (
                      <img src={userInfo.profileImage} alt="Profile" className="w-8 h-8 rounded-full border border-white" />
                    )}
                    <div className="overflow-hidden">
                      <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                        Connected via {formatSocialProvider(userInfo.typeOfLogin)}
                      </p>
                      <p className="text-sm font-medium dark:text-slate-200 truncate">{userInfo.email || userInfo.name}</p>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={disconnect} // Use the unified disconnect method
                className="w-full py-3 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 font-semibold rounded-xl transition"
              >
                Disconnect
              </button>
            </div>
          ) : (
            /* --- DISCONNECTED STATE --- */
            <>
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 px-1">Social Login</p>
                {socialOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => handleSocialLogin(option.id, option.action)}
                    disabled={!!connectingProvider}
                    className="w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition shadow-sm font-medium text-gray-700 dark:text-slate-200 disabled:opacity-50"
                  >
                    <img src={option.icon} className="w-5 h-5" alt={option.label} />
                    {connectingProvider === option.id ? 'Connecting...' : option.label}
                  </button>
                ))}
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-100 dark:border-slate-800"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white dark:bg-slate-900 px-2 text-gray-400">Or use a wallet</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {traditionalWallets?.map((wallet) => (
                  <button
                    key={wallet.id}
                    className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50/30 transition group"
                    onClick={() => {
                      closeModal()
                      wallet.connect()
                    }}
                  >
                    <img src={wallet.metadata.icon} alt={wallet.id} className="w-10 h-10 rounded-lg group-hover:scale-110 transition" />
                    <span className="font-semibold text-gray-800 dark:text-slate-200">
                      {wallet.id === WalletId.KMD ? 'LocalNet' : wallet.metadata.name}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </dialog>
  )
}

export default ConnectWallet
