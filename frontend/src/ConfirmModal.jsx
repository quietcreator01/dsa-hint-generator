// Generic confirmation modal used across the app (e.g. logout, delete account,
// delete user) — content and styling are fully driven by props, no internal state.

// Clicking the overlay cancels; clicking inside the modal box is stopped from
// bubbling up so it doesn't trigger that same cancel behavior.
function ConfirmModal({ title, message, confirmLabel, danger, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="modal-actions">
          <button type="button" className="ghost-btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={danger ? 'danger-btn-solid' : 'primary-btn'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmModal