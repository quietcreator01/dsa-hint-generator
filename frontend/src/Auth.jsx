// Login/signup screen. Toggles between the two modes with shared form state,
// and on success stores the token/user in localStorage and notifies the parent
// via onAuthSuccess so App can switch to the main view.

import { useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

function Auth({ onAuthSuccess }) {
	const [isLogin, setIsLogin] = useState(true)
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [error, setError] = useState('')
	const [loading, setLoading] = useState(false)

	// Submits to /login or /signup depending on the current mode, using the same form fields
	const handleSubmit = async (e) => {
		e.preventDefault()
		setError('')
		setLoading(true)

		const endpoint = isLogin ? 'login' : 'signup'

		try {
			const response = await fetch(`${API_URL}/api/auth/${endpoint}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password }),
			})

			const data = await response.json()

			if (response.ok) {
				localStorage.setItem('token', data.token)
				localStorage.setItem('user', JSON.stringify(data.user))
				onAuthSuccess(data.user)
			} else {
				setError(data.error || 'Something went wrong')
			}
		} catch (err) {
			setError('Network error — is the backend running?')
		} finally {
			setLoading(false)
		}
	}

	return (
		<div id="auth-container">
			<div className="auth-logo">
			<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#06110C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
				<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
			</svg>
			</div>
			<h2>{isLogin ? 'Log In' : 'Sign Up'}</h2>
			<p className="auth-subtitle">
				{isLogin ? 'Sign in to get hints on your DSA problems.' : 'Create an account to start getting hints.'}
			</p>

			<form onSubmit={handleSubmit}>
				<input
					type="email"
					placeholder="Email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					required
				/>
				<input
					type="password"
					placeholder="Password"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					required
				/>

				{error && <p className="error-text">{error}</p>}

				<button type="submit" disabled={loading}>
					{loading ? 'Please wait...' : isLogin ? 'Log In' : 'Sign Up'}
				</button>
			</form>

			<div className="auth-footer">
				<p>
					{isLogin ? "Don't have an account? " : 'Already have an account? '}
					<button type="button" className="link-btn" onClick={() => setIsLogin(!isLogin)}>
						{isLogin ? 'Sign Up' : 'Log In'}
					</button>
				</p>
			</div>
		</div>
	)
}

export default Auth