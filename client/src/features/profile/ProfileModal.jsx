import { Icons } from '@shared';
import api from '@utils/api';
import '@styles/features/profile.css';

function ProfileModal({ user, onClose, onLogout, token }) {
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && onClose) onClose();
  };

  const handleCloseButtonClick = (e) => {
    e.stopPropagation();
    if (onClose) onClose();
  };

  const handleLogoutClick = async () => {
    try {
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      await api.post('/logs', {
        action: 'LOGOUT',
        details: 'User logged out via Mobile App',
        timestamp: new Date().toISOString()
      }, config);
    } catch (error) {
      console.error('Failed to log logout activity:', error);
    } finally {
      onLogout();
    }
  };

  const displayName = user?.fullName || (user?.firstName && user?.lastName
    ? `${user.firstName} ${user.lastName}` : 'Crew Member');

  return (
    <div className="profile-modal-overlay" onClick={handleOverlayClick}>
      
      {/* The White Card */}
      <div className="profile-modal-card">
        
        {/* Close Button (X) */}
        <button className="close-modal-btn" onClick={handleCloseButtonClick}>
          ×
        </button>

        <div className="modal-avatar">
          {/* Use your Icon component or the SVG */}
          <Icons.Profile />
        </div>

        <h2 className="modal-name">{displayName}</h2>
        <span className="modal-role">{user.role || "Crew"}</span>
        
        <div className="modal-info-row">
          <span className="label">Joined:</span>
          <span className="value">{user.dateCreated || "N/A"}</span>
        </div>

        <div className="modal-divider"></div>

        <button className="modal-logout-btn" onClick={handleLogoutClick}>
          Log Out
        </button>

      </div>
    </div>
  );
}

export default ProfileModal;