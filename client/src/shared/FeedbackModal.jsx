import '@styles/shared/feedback-modal.css';

const FeedbackModal = ({ type = 'info', title, message, subMessage, onClose, onConfirm, confirmLabel = "OK" }) => {
  const icons = {
    success: (
      <svg viewBox="0 0 24 24" width="50" height="50" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5"></path>
      </svg>
    ),
    error: (
      <svg viewBox="0 0 24 24" width="50" height="50" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    ),
    warning: <span style={{ fontSize: '40px', fontWeight: 'bold' }}>!</span>,
    info: <span style={{ fontSize: '40px', fontWeight: 'bold' }}>ℹ</span>,
    restore: (
      <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
        <path d="M3 3v5h5"></path>
      </svg>
    )
  };

  const styles = {
    success: { card: 'success-card', icon: 'success-icon', btn: 'btn-success' },
    error: { card: 'error-card', icon: 'error-icon', btn: 'btn-danger' },
    warning: { card: 'warning-card', icon: 'warning-icon', btn: 'btn-warning' },
    info: { card: 'info-card', icon: 'info-icon', btn: 'btn-primary' },
    restore: { card: 'restore-card', icon: 'success-icon', btn: 'btn-success' }
  };

  const style = styles[type] || styles.info;
  const iconContent = icons[type] || icons.info;

  return (
    <div className="modal-backdrop">
      <div className={`modal-card ${style.card}`} onClick={e => e.stopPropagation()}>
        <div className={`modal-icon ${style.icon}`}>
          {iconContent}
        </div>
        <h3>{title}</h3>
        {message && <p className="modal-message">{message}</p>}
        {subMessage && <p className="modal-sub-text">{subMessage}</p>}
        <div className="modal-actions">
          {onConfirm ? (
            <>
              <button className="btn-secondary" onClick={onClose}>Cancel</button>
              <button className={style.btn} onClick={onConfirm}>{confirmLabel}</button>
            </>
          ) : (
            <button className={style.btn} onClick={onClose} style={{ width: '100%' }}>
              {confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeedbackModal;
