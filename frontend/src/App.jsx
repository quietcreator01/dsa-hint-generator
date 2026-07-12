// Root component and main app shell. Handles auth state, the core hint-request
// flow (textarea -> get hint -> show progressive hints), credit display, and
// switching between the main view, history panel, and admin panel.

import { useState, useEffect } from 'react'
import Auth from './Auth'
import History from './History'
import './App.css'
import ConfirmModal from './ConfirmModal'
import AdminPanel from './AdminPanel'
import Toast from './Toast'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

// Visual progress bar for remaining credits. Color reflects urgency (low/mid/high)
// and, when credits are below max, shows an estimated time until the next refill.
function CreditBar({ credits, max, nextRefillMs }) {
	const pct = Math.min(100, Math.max(0, (credits / max) * 100))
	const level = credits <= 2 ? 'low' : credits < max ? 'mid' : 'high'
	// rounds up so "almost refilled" doesn't display as "0h left"
	const hoursLeft = nextRefillMs ? Math.max(1, Math.ceil(nextRefillMs / (60 * 60 * 1000))) : null

	return (
		<div className="credit-bar">
			<div className="label-row">
				<span>Credits remaining</span>
				<span>{Math.min(credits, max)}/{max}</span>
			</div>
			<div className="track">
				<div className={`fill ${level}`} style={{ width: `${pct}%` }} />
			</div>
			{credits < max && hoursLeft !== null && (
				<p className="refill-note">Refills in ~{hoursLeft}h</p>
			)}
		</div>
	)
}

// Placeholder shown in place of a hint box while a hint request is in flight
function HintSkeleton() {
	return (
		<div className="hint-box skeleton-box">
			<div className="hint-number skeleton-circle" />
			<div className="hint-content">
				<div className="skeleton-line" />
				<div className="skeleton-line" />
				<div className="skeleton-line short" />
			</div>
		</div>
	)
}

function App() {
	// Hydrate user from localStorage synchronously so the app doesn't flash the login screen on refresh
	const [user, setUser] = useState(() => {
		const stored = localStorage.getItem('user')
		return stored ? JSON.parse(stored) : null
	})
	const [problem, setProblem] = useState('')
	const [hints, setHints] = useState([])
	const [hintLevel, setHintLevel] = useState(0)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState('')
	const [showHistory, setShowHistory] = useState(false)
	const [nextRefillMs, setNextRefillMs] = useState(null)
	const [maxCredits, setMaxCredits] = useState(10) // fallback only, overwritten by server response
	const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
	const [difficulty, setDifficulty] = useState(null)
	const [showAdmin, setShowAdmin] = useState(false)
	const [toast, setToast] = useState(null)

	// On mount, if a user was restored from localStorage, re-sync with the server
	// to get a fresh credit balance (in case a refill happened since last visit)
	useEffect(() => {
		const storedUser = localStorage.getItem('user')
		if (storedUser) {
			setUser(JSON.parse(storedUser))
			refreshMe()
		}
	}, [])

	// Fetches the current user's profile from the server, applying any pending
	// credit refill, and syncs both React state and localStorage
	const refreshMe = async () => {
		try {
			const token = localStorage.getItem('token')
			const res = await fetch(`${API_URL}/api/auth/me`, {
				headers: { Authorization: `Bearer ${token}` },
			})
			const data = await res.json()
			if (res.ok) {
				setUser({ ...data.user, isAdmin: data.isAdmin })
				localStorage.setItem('user', JSON.stringify({ ...data.user, isAdmin: data.isAdmin }))
				setNextRefillMs(data.nextRefillMs)
				setMaxCredits(data.maxCredits)
			}
		} catch (err) {
			console.error(err)
		}
	}

	// Clears auth state/storage and resets the hint flow
	const handleLogout = () => {
		localStorage.removeItem('token')
		localStorage.removeItem('user')
		setUser(null)
		setHints([])
		setHintLevel(0)
		setError('')
	}

	// Resets the problem input and hint state to start fresh, without logging out
	const handleNewProblem = () => {
		setProblem('')
		setHints([])
		setHintLevel(0)
		setError('')
	}

	// Permanently deletes the account on the server, then logs out locally on success
	const confirmDeleteAccount = async () => {
		setShowDeleteConfirm(false)
		try {
			const token = localStorage.getItem('token')
			const res = await fetch(`${API_URL}/api/auth/me`, {
				method: 'DELETE',
				headers: { Authorization: `Bearer ${token}` },
			})
			if (res.ok) {
				handleLogout()
			} else {
				const data = await res.json()
				setError(data.error || 'Failed to delete account')
				showToast(data.error || 'Failed to delete account', 'error')
			}
		} catch (err) {
			setError('Network error — is the backend running?')
			showToast('Network error', 'error')
		}
	}

	const confirmLogout = () => {
		setShowLogoutConfirm(false)
		handleLogout()
	}

	// Requests the next hint from the backend for the current problem.
	// Sends previousHints so the server can avoid repeating earlier hints.
	const handleGetHint = async () => {
		const trimmed = problem.trim()
		if (!trimmed) {
			setError('Please enter a problem description')
			return
		}
		if (trimmed.length < 15) {
			setError('Add a bit more detail to your problem description')
			return
		}

		setLoading(true)
		setError('')

		try {
			const token = localStorage.getItem('token')
			const response = await fetch(`${API_URL}/api/hint`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ problem: trimmed, hintLevel, previousHints: hints }),
			})

			const data = await response.json()

			if (response.ok) {
				setHints((prev) => [...prev, data.hint])
				setHintLevel((prev) => prev + 1)
				setUser((prev) => ({ ...prev, credits: data.creditsRemaining }))

				setMaxCredits(data.maxCredits)
			} else {
				setError(data.error || 'Something went wrong')
				// server includes refill info specifically on the "out of credits" error
				if (data.nextRefillMs) setNextRefillMs(data.nextRefillMs)
				if (data.maxCredits) setMaxCredits(data.maxCredits)
			}
		} catch (err) {
			setError('Network error — is the backend running?')
		} finally {
			setLoading(false)
		}
	}

	// Called by the Auth component after a successful login/signup
	const handleAuthSuccess = (userData) => {
		setUser(userData)
		refreshMe()
	}

	const showToast = (message, type = 'success') => {
		setToast({ message, type })
	}

	// Not logged in: show only the auth screen
	if (!user) {
		return (
			<div className="app-card">
				<Auth onAuthSuccess={handleAuthSuccess} />
			</div>
		)
	}

	return (
		<div className="app-card" id="app-container">
			{showHistory ? (
				<History onClose={() => setShowHistory(false)} />
			) : showAdmin ? (
				<AdminPanel onClose={() => setShowAdmin(false)} />
			) : (
				<>
					<div className="app-header">
						<div className="header-row">
							<h1>AI DSA Hint Generator</h1>
							<div className="header-actions">
								<button type="button" onClick={() => setShowHistory(true)}>History</button>
								{user.isAdmin && (
									<button type="button" onClick={() => setShowAdmin(true)}>Admin</button>
								)}
								<button type="button" onClick={() => setShowLogoutConfirm(true)}>Log out</button>
								<button
									type="button"
									className="danger-btn"
									onClick={() => setShowDeleteConfirm(true)}
									disabled={user.isAdmin}
									title={user.isAdmin ? "Admin accounts can't be deleted" : 'Delete account'}
								>
									Delete
								</button>
							</div>
						</div>
						<div className="user-row">
							<div className="user-avatar">{user.email[0].toUpperCase()}</div>
							<span className="subtitle" style={{ margin: 0 }}>{user.email}</span>
						</div>
					</div>

					<CreditBar credits={user.credits} max={maxCredits} nextRefillMs={nextRefillMs} />

					<textarea
						placeholder="Paste your DSA problem here..."
						value={problem}
						onChange={(e) => setProblem(e.target.value)}
						onKeyDown={(e) => {
							// Ctrl/Cmd+Enter submits without needing to reach for the button
							if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
								handleGetHint()
							}
						}}
						rows={8}
					/>

					<div className="btn-row">
						<button
							type="button"
							className="primary-btn"
							onClick={handleGetHint}
							disabled={loading}
						>
							{loading ? 'Thinking...' : hintLevel === 0 ? 'Get Hint' : 'Get Next Hint'}
						</button>
						{hintLevel > 0 && (
							<button type="button" className="ghost-btn" onClick={handleNewProblem}>
								New Problem
							</button>
						)}
					</div>

					{error && <p className="error-text">{error}</p>}

					{loading && <HintSkeleton />}

					{hints.map((h, i) => (
						<div className="hint-box" key={i}>
							<div className="hint-number">{i + 1}</div>
							<div className="hint-content">
								<h3>Hint {i + 1}</h3>
								<p>{h}</p>
							</div>
						</div>
					))}
				</>
			)}

			{showLogoutConfirm && (
				<ConfirmModal
					title="Log out?"
					message="You'll need to sign in again to continue using the hint generator."
					confirmLabel="Log out"
					onConfirm={confirmLogout}
					onCancel={() => setShowLogoutConfirm(false)}
				/>
			)}

			{showDeleteConfirm && (
				<ConfirmModal
					title="Delete your account?"
					message="This permanently removes your account and all saved hint history. This cannot be undone."
					confirmLabel="Delete permanently"
					danger
					onConfirm={confirmDeleteAccount}
					onCancel={() => setShowDeleteConfirm(false)}
				/>
			)}

			{toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
		</div>
	)
}

export default App