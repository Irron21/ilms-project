import React from 'react';
import { Icons } from './Icons';
import './Profile.css';

function Profile({ user, onBack, onLogout }) {
  const dateCreated = user.dateCreated;

  return (
    <div className="profile-container">
      <div className="back-button-wrapper" onClick={onBack}>
        <Icons.ArrowLeft />
      </div>

      <div className="profile-content">
        <div className="profile-avatar-large">
          <svg viewBox="0 0 24 24" fill="black">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.7 9 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
        </div>
        <h2 className="profile-name">{user.fullName || "Crew Member"}</h2>
        <div className="profile-role">{user.role || "Crew"}</div>
        <div className="profile-date">Date Created: {dateCreated}</div>
        
        <hr className="profile-divider" />

        <button className="logout-btn" onClick={onLogout}>
          Logout
        </button>
      </div>
    </div>
  );
}

export default Profile;