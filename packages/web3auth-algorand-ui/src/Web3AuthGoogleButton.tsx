import { useEffect, useState } from 'react'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import { FaCheck, FaCopy, FaGoogle } from 'react-icons/fa'
import { useWeb3Auth } from '@tokenizerwa/web3auth-algorand'

export function Web3AuthGoogleButton() {
  const { isConnected, isLoading, error, algorandAccount, userInfo, login, logout } = useWeb3Auth()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-dropdown]')) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  const getAddressString = (): string => {
    if (!algorandAccount?.address) return ''
    if (typeof algorandAccount.address === 'object' && algorandAccount.address !== null) {
      if ('toString' in algorandAccount.address && typeof algorandAccount.address.toString === 'function') {
        return algorandAccount.address.toString()
      }
      if ('addr' in algorandAccount.address) {
        return String(algorandAccount.address.addr)
      }
      return ''
    }

    return String(algorandAccount.address)
  }

  const ellipseAddress = (address: string = '', startChars = 6, endChars = 4): string => {
    if (!address || address.length <= startChars + endChars) {
      return address
    }
    return `${address.slice(0, startChars)}...${address.slice(-endChars)}`
  }

  const handleLogin = async () => {
    try {
      await login()
    } catch (err) {
      console.error('Login error:', err)
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
      setIsDropdownOpen(false)
    } catch (err) {
      console.error('Logout error:', err)
    }
  }

  const handleCopyAddress = () => {
    const address = getAddressString()
    if (!address) return

    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (error && !isConnected) {
    return (
      <div className="flex items-center gap-2">
        <button onClick={handleLogin} disabled={isLoading} className="btn btn-sm btn-outline btn-error">
          {isLoading ? (
            <>
              <AiOutlineLoading3Quarters className="animate-spin" />
              Connecting...
            </>
          ) : (
            'Retry Login'
          )}
        </button>
        <span className="text-xs text-error max-w-xs truncate">{error}</span>
      </div>
    )
  }

  if (!isConnected) {
    return (
      <button
        onClick={handleLogin}
        disabled={isLoading}
        className="btn btn-sm bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 gap-2 font-medium shadow-sm transition-all"
        title="Sign in with your Google account to create an Algorand wallet"
      >
        {isLoading ? (
          <>
            <AiOutlineLoading3Quarters className="animate-spin text-gray-600" />
            <span>Connecting...</span>
          </>
        ) : (
          <>
            <FaGoogle className="text-lg text-blue-500" />
            <span>Sign in with Google</span>
          </>
        )}
      </button>
    )
  }

  if (algorandAccount && isConnected) {
    const address = getAddressString()
    const firstLetter = address ? address[0].toUpperCase() : 'A'

    return (
      <div className="dropdown dropdown-end" data-dropdown>
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="btn btn-sm btn-ghost gap-2 hover:bg-base-200"
          title={`Connected: ${address}`}
        >
          <div className="flex items-center gap-2">
            {userInfo?.profileImage ? (
              <img
                src={userInfo.profileImage}
                alt="Profile"
                className="w-6 h-6 rounded-full object-cover ring-2 ring-primary ring-offset-1"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-primary text-primary-content flex items-center justify-center text-xs font-bold">
                {firstLetter}
              </div>
            )}
            <span className="font-mono text-sm font-medium">{ellipseAddress(address)}</span>
            <svg
              className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {isDropdownOpen && (
          <ul className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-72 border border-base-300 mt-2">
            {userInfo && (userInfo.name || userInfo.email) && (
              <>
                <li className="menu-title px-3 py-2">
                  <div className="flex items-center gap-3">
                    {userInfo.profileImage ? (
                      <img
                        src={userInfo.profileImage}
                        alt="Profile"
                        className="w-10 h-10 rounded-full object-cover ring-2 ring-primary"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary text-primary-content flex items-center justify-center text-lg font-bold">
                        {firstLetter}
                      </div>
                    )}
                    <div className="flex flex-col">
                      {userInfo.name && <span className="font-semibold text-base-content">{userInfo.name}</span>}
                      {userInfo.email && <span className="text-xs text-base-content/70 break-all">{userInfo.email}</span>}
                    </div>
                  </div>
                </li>
                <div className="divider my-1"></div>
              </>
            )}

            <li className="menu-title px-3">
              <span className="text-xs uppercase">Algorand Address</span>
            </li>
            <li>
              <div className="bg-base-200 rounded-lg p-2 font-mono text-xs break-all cursor-default hover:bg-base-200">
                {address}
              </div>
            </li>
            <li>
              <button onClick={handleCopyAddress} className="text-sm gap-2">
                {copied ? (
                  <>
                    <FaCheck className="text-success" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <FaCopy />
                    <span>Copy Address</span>
                  </>
                )}
              </button>
            </li>

            <div className="divider my-1"></div>

            <li>
              <button onClick={handleLogout} disabled={isLoading} className="text-sm text-error hover:bg-error/10 gap-2">
                {isLoading ? (
                  <>
                    <AiOutlineLoading3Quarters className="animate-spin" />
                    <span>Disconnecting...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Disconnect</span>
                  </>
                )}
              </button>
            </li>
          </ul>
        )}
      </div>
    )
  }

  if (isLoading) {
    return (
      <button disabled className="btn btn-sm btn-ghost gap-2">
        <AiOutlineLoading3Quarters className="animate-spin" />
        <span>Initializing...</span>
      </button>
    )
  }

  return null
}

export default Web3AuthGoogleButton
