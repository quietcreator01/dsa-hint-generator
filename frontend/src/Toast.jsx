// Small auto-dismissing notification banner, used for success/error feedback
// after actions like deleting an account. Also dismissible by clicking it.

import { useEffect } from 'react'

function Toast({ message, type = 'success', onDismiss }) {
  // Auto-dismiss after 2.5s; timer resets if onDismiss identity changes
  useEffect(() => {
    const timer = setTimeout(onDismiss, 2500)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div className={`toast toast-${type}`} onClick={onDismiss}>
      {message}
    </div>
  )
}

export default Toast