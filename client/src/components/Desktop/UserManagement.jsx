import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './UserManagement.css';

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [roleFilter, setRoleFilter] = useState('All');
  
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', phone: '', dob: '', role: 'Crew', password: '', confirmPassword: ''
  });
  
  const [errors, setErrors] = useState({ password: '', confirm: '', phone: '', email: '' });
  const token = localStorage.getItem('token'); 

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
        const res = await axios.get('http://localhost:4000/api/users', {
            headers: { Authorization: `Bearer ${token}` }
        });
        setUsers(res.data);
    } catch (err) {
        console.error(err);
    }
  };

  // --- VALIDATION LOGIC ---
  const validateEmail = (email) => {
      if (!email) return ""; 
      const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return regex.test(email) ? "" : "Please enter a valid email address.";
  };

  const validatePassword = (pass) => {
      if (!pass) return ""; 
      const regex = /^[A-Z](?=.*\d)[A-Za-z\d]{7,}$/;
      if (!regex.test(pass)) {
          if (!/^[A-Z]/.test(pass)) return "Must start with a Capital letter.";
          if (!/\d/.test(pass)) return "Must contain at least one number.";
          if (/[^A-Za-z0-9]/.test(pass)) return "No special characters allowed.";
          if (pass.length < 8) return "Must be at least 8 characters long.";
      }
      return ""; 
  };

  const validatePhone = (phone) => {
      if (!phone) return ""; 
      const regex = /^0\d{10}$/;
      return regex.test(phone) ? "" : "Must be 11 digits starting with 0.";
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'phone' && !/^\d*$/.test(value)) return; 
    if (name === 'phone' && value.length > 11) return;

    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'email') setErrors(prev => ({ ...prev, email: validateEmail(value) }));
    if (name === 'password') setErrors(prev => ({ ...prev, password: validatePassword(value) }));
    if (name === 'phone') setErrors(prev => ({ ...prev, phone: validatePhone(value) }));
    if (name === 'confirmPassword' || name === 'password') {
        setErrors(prev => ({ 
            ...prev, 
            confirm: (name === 'confirmPassword' ? value : formData.confirmPassword) !== (name === 'password' ? value : formData.password) ? "Passwords do not match." : "" 
        }));
    }
  };

  const handleCreateSubmit = async () => {
    const emailError = validateEmail(formData.email);
    const passError = validatePassword(formData.password);
    const phoneError = validatePhone(formData.phone);
    const matchError = formData.password !== formData.confirmPassword ? "Passwords do not match." : "";

    if (emailError || passError || matchError || phoneError) {
        setErrors({ email: emailError, password: passError, confirm: matchError, phone: phoneError });
        return; 
    }
    
    try {
        await axios.post('http://localhost:4000/api/users/create', formData, {
            headers: { Authorization: `Bearer ${token}` }
        });
        alert("User Created!");
        setShowCreateModal(false);
        fetchUsers();
    } catch (err) {
        alert("Failed to create user.");
    }
  };

  const handleEditClick = (user) => {
    setCurrentUser(user);
    const formattedDob = user.dob ? new Date(user.dob).toISOString().split('T')[0] : '';
    setFormData({
        firstName: user.firstName, lastName: user.lastName, email: user.email || '', phone: user.phone || '',
        dob: formattedDob, role: user.role, password: '', confirmPassword: ''
    });
    setErrors({ password: '', confirm: '', phone: '', email: '' }); 
    setShowEditModal(true);
  };

  const handleUpdateSubmit = async () => {
      const emailError = validateEmail(formData.email);
      const phoneError = validatePhone(formData.phone);
      if (emailError || phoneError) {
          setErrors(prev => ({ ...prev, email: emailError, phone: phoneError }));
          return;
      }
      try {
        await axios.put(`http://localhost:4000/api/users/${currentUser.userID}`, formData, {
            headers: { Authorization: `Bearer ${token}` }
        });
        alert("User Updated!");
        setShowEditModal(false);
        fetchUsers();
    } catch (err) { alert("Failed update"); }
  };

  const handleDelete = async (id) => {
      if(!window.confirm("Delete this user?")) return;
      try {
        await axios.delete(`http://localhost:4000/api/users/${id}`, { headers: { Authorization: `Bearer ${token}` }});
        fetchUsers();
      } catch(e) { alert("Error"); }
  };

  const filteredUsers = users.filter(user => {
      if (roleFilter === 'All') return true;
      return user.role.toLowerCase() === roleFilter.toLowerCase();
  });

  return (
    <div className="user-mgmt-container">
      {/* Header with improved padding, design, and Count Badge */}
      <div className="header-actions">
          <div className="filter-group-inline">
              <label>Filter by Role:</label>
              <select 
                  value={roleFilter} 
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="role-filter-dropdown"
              >
                  <option value="All">All Roles</option>
                  <option value="Admin">Admin</option>
                  <option value="Operations">Operations</option>
                  <option value="Driver">Driver</option>
                  <option value="Helper">Helper</option>
              </select>
              
              {/* Added Count Badge based on ShipmentView style */}
              <div className="count-badge">
                  {filteredUsers.length} User{filteredUsers.length !== 1 ? 's' : ''}
              </div>
          </div>

          <button className="create-user-btn" onClick={() => {
              setFormData({ firstName: '', lastName: '', email: '', phone: '', dob: '', role: 'Crew', password: '', confirmPassword: '' });
              setErrors({ password: '', confirm: '', phone: '', email: '' });
              setShowCreateModal(true);
          }}>
              + Create User
          </button>
      </div>

      <div className="table-wrapper">
        <table className="user-table">
          <thead>
            <tr>
              <th>Employee ID</th><th>Name</th><th>Phone Number</th><th>Email</th><th>Role</th><th>Date Created</th>
              <th style={{textAlign: 'center'}}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length > 0 ? filteredUsers.map(u => (
              <tr key={u.userID}>
                <td>{u.employeeID || 'N/A'}</td>
                <td>{u.firstName} {u.lastName}</td>
                <td>{u.phone || '-'}</td>
                <td>{u.email || '-'}</td>
                <td><span className={`role-tag ${u.role.toLowerCase()}`}>{u.role}</span></td>
                <td>{new Date(u.dateCreated).toLocaleDateString()}</td>
                <td className="action-cells">
                   <button className="icon-btn edit-btn" onClick={() => handleEditClick(u)} title="Edit">
                        <svg viewBox="0 0 24 24" fill="black" width="18" height="18">
                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                        </svg>
                    </button>
                    <button className="icon-btn delete-btn" onClick={() => handleDelete(u.userID)} title="Delete">
                        <svg viewBox="0 0 24 24" fill="black" width="18" height="18">
                            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                    </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="7" className="empty-state">
                   No users found with the role "{roleFilter}"
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* --- CREATE MODAL --- */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>Create New User</h3>
            
            <div className="row-inputs">
                <div className="col"><label>First Name</label><input type="text" name="firstName" value={formData.firstName} onChange={handleInputChange} placeholder="John" /></div>
                <div className="col"><label>Last Name</label><input type="text" name="lastName" value={formData.lastName} onChange={handleInputChange} placeholder="Doe" /></div>
            </div>

            <label>Email</label>
            <input 
                type="email" 
                name="email" 
                value={formData.email} 
                onChange={handleInputChange} 
                placeholder="user@domain.com"
                className={errors.email ? 'input-error' : ''}
            />
            {errors.email && <span className="error-text">{errors.email}</span>}

            <label>Phone Number (PH)</label>
            <input type="text" name="phone" value={formData.phone} onChange={handleInputChange} placeholder="09xxxxxxxxx" className={errors.phone ? 'input-error' : ''} />
            {errors.phone && <span className="error-text">{errors.phone}</span>}

            <div className="row-inputs">
                <div className="col"><label>Date of Birth</label><input type="date" name="dob" value={formData.dob} onChange={handleInputChange} /></div>
                <div className="col">
                    <label>Role</label>
                    <select name="role" value={formData.role} onChange={handleInputChange}>
                        <option value="Admin">Admin</option>
                        <option value="Operations">Operations</option>
                        <option value="Crew">Crew</option>
                        <option value="Driver">Driver</option>
                        <option value="Helper">Helper</option>
                    </select>
                </div>
            </div>

            <label>Password</label>
            <input type="password" name="password" value={formData.password} onChange={handleInputChange} className={errors.password ? 'input-error' : ''} />
            {errors.password && <span className="error-text">{errors.password}</span>}

            <label>Confirm Password</label>
            <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleInputChange} className={errors.confirm ? 'input-error' : ''} />
            {errors.confirm && <span className="error-text">{errors.confirm}</span>}

            <div className="modal-footer">
                <button className="btn-cancel" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button 
                    className="btn-save" 
                    onClick={handleCreateSubmit} 
                    disabled={!!errors.password || !!errors.confirm || !!errors.phone || !!errors.email || !formData.firstName || !formData.password}
                >
                    Save User
                </button>
            </div>
          </div>
        </div>
      )}

      {/* --- EDIT MODAL --- */}
      {showEditModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>Edit User</h3>
            <div className="row-inputs">
                <div className="col"><label>First Name</label><input type="text" name="firstName" value={formData.firstName} onChange={handleInputChange} /></div>
                <div className="col"><label>Last Name</label><input type="text" name="lastName" value={formData.lastName} onChange={handleInputChange} /></div>
            </div>
            
            <label>Email</label>
            <input type="email" name="email" value={formData.email} onChange={handleInputChange} className={errors.email ? 'input-error' : ''} />
            {errors.email && <span className="error-text">{errors.email}</span>}
            
            <label>Phone Number</label>
            <input type="text" name="phone" value={formData.phone} onChange={handleInputChange} className={errors.phone ? 'input-error' : ''} />
            {errors.phone && <span className="error-text">{errors.phone}</span>}

            <div className="row-inputs">
                <div className="col"><label>Date of Birth</label><input type="date" name="dob" value={formData.dob} onChange={handleInputChange} /></div>
                <div className="col">
                    <label>Role</label>
                    <select name="role" value={formData.role} onChange={handleInputChange}>
                        <option value="Admin">Admin</option>
                        <option value="Operations">Operations</option>
                        <option value="Crew">Crew</option>
                        <option value="Driver">Driver</option>
                        <option value="Helper">Helper</option>
                    </select>
                </div>
            </div>

            <div className="modal-footer">
                <button className="btn-cancel" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button className="btn-save" onClick={handleUpdateSubmit} disabled={!!errors.phone || !!errors.email}>Save User</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserManagement;