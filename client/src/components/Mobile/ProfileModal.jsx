import React from 'react';
import './ProfileModal.css';
import { Icons } from '../Icons';

function ProfileModal({ user, onClose, onLogout }) {
  
  // 1. Handle Overlay Click (Close)
  const handleOverlayClick = (e) => {
    // Only close if we clicked the overlay itself, not a child
    if (e.target === e.currentTarget) {
      if (onClose) onClose(); 
    }
  };

  // 2. Handle X Button Click (Close)
  const handleCloseButtonClick = (e) => {
    e.stopPropagation();
    if (onClose) onClose();
  };

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

        <h2 className="modal-name">{user.fullName || "Crew Member"}</h2>
        <span className="modal-role">{user.role || "Crew"}</span>
        
        <div className="modal-info-row">
          <span className="label">Joined:</span>
          <span className="value">{user.dateCreated || "N/A"}</span>
        </div>

        <div className="modal-divider"></div>

        <button className="modal-logout-btn" onClick={onLogout}>
          Log Out
        </button>

      </div>
    </div>
  );
}

export default ProfileModal;