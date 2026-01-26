import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './UserManagement.css';

function UserManagement({ activeTab = "users" }) { 
  
  // --- SHARED PAGINATION STATE ---
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  // --- USER STATE ---
  const [users, setUsers] = useState([]);
  const [roleFilter, setRoleFilter] = useState('All');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [userForm, setUserForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', dob: '', role: 'Crew', password: '', confirmPassword: ''
  });
  const [errors, setErrors] = useState({ password: '', confirm: '', phone: '', email: '' });

  // --- TRUCK STATE ---
  const [vehicles, setVehicles] = useState([]);
  const [truckFilter, setTruckFilter] = useState('All');
  const [showTruckModal, setShowTruckModal] = useState(false);
  const [showEditTruckModal, setShowEditTruckModal] = useState(false);
  const [currentVehicle, setCurrentVehicle] = useState(null);
  const [truckForm, setTruckForm] = useState({ plateNo: '', type: '6-Wheeler', status: 'Working' });

  const token = localStorage.getItem('token'); 

  // Reset page when switching tabs or filters to avoid empty views
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, roleFilter, truckFilter]);

  // --- FETCH DATA ---
  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
    else fetchVehicles();
  }, [activeTab]);

  const fetchUsers = async () => {
    try {
        const res = await axios.get('http://localhost:4000/api/users', { headers: { Authorization: `Bearer ${token}` } });
        setUsers(res.data);
    } catch (err) { console.error(err); }
  };
  
  const fetchVehicles = async () => {
    try {
        const res = await axios.get('http://localhost:4000/api/vehicles', { headers: { Authorization: `Bearer ${token}` } });
        setVehicles(res.data);
    } catch (err) { console.error(err); }
  };

  // --- PAGINATION RENDERER ---
  const renderPagination = (totalItems) => {
    const totalPages = Math.ceil(totalItems / rowsPerPage) || 1;
    
    return (
        <div className="pagination-footer">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)}>Prev</button>
            {[...Array(totalPages)].map((_, i) => (
                <button 
                    key={i} 
                    className={currentPage === i + 1 ? 'active' : ''}
                    onClick={() => setCurrentPage(i + 1)}
                >
                    {i + 1}
                </button>
            ))}
            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)}>Next</button>
        </div>
    );
};

  // --- GHOST ROW RENDERER ---
  const renderGhostRows = (currentCount, colSpan) => {
      const ghostsNeeded = rowsPerPage - currentCount;
      if (ghostsNeeded <= 0) return null;
      return Array.from({ length: ghostsNeeded }).map((_, idx) => (
          <tr key={`ghost-${idx}`} className="ghost-row">
              <td colSpan={colSpan}>&nbsp;</td>
          </tr>
      ));
  };

  // --- USER HANDLERS ---
  const validateEmail = (email) => {
      if (!email) return ""; 
      const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return regex.test(email) ? "" : "Invalid email format.";
  };
  const validatePassword = (pass) => {
      if (!pass) return ""; 
      const regex = /^[A-Z](?=.*\d)[A-Za-z\d]{7,}$/;
      if (!regex.test(pass)) return "Invalid password format (8+ chars, 1 capital, 1 number).";
      return ""; 
  };
  const validatePhone = (phone) => {
      if (!phone) return ""; 
      const regex = /^0\d{10}$/;
      return regex.test(phone) ? "" : "Must be 11 digits starting with 0.";
  };

  const handleUserInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'phone' && !/^\d*$/.test(value)) return; 
    if (name === 'phone' && value.length > 11) return;

    setUserForm(prev => ({ ...prev, [name]: value }));

    if (name === 'email') setErrors(prev => ({ ...prev, email: validateEmail(value) }));
    if (name === 'password') setErrors(prev => ({ ...prev, password: validatePassword(value) }));
    if (name === 'phone') setErrors(prev => ({ ...prev, phone: validatePhone(value) }));
    if (name === 'confirmPassword' || name === 'password') {
        setErrors(prev => ({ 
            ...prev, 
            confirm: (name === 'confirmPassword' ? value : userForm.confirmPassword) !== (name === 'password' ? value : userForm.password) ? "Passwords do not match." : "" 
        }));
    }
  };

  const handleCreateSubmit = async () => {
    const emailError = validateEmail(userForm.email);
    const passError = validatePassword(userForm.password);
    const phoneError = validatePhone(userForm.phone);
    const matchError = userForm.password !== userForm.confirmPassword ? "Passwords do not match." : "";

    if (emailError || passError || matchError || phoneError) {
        setErrors({ email: emailError, password: passError, confirm: matchError, phone: phoneError });
        return; 
    }
    
    try {
        await axios.post('http://localhost:4000/api/users/create', userForm, {
            headers: { Authorization: `Bearer ${token}` }
        });
        alert("User Created!");
        setShowCreateModal(false);
        fetchUsers();
    } catch (err) { alert("Failed to create user."); }
  };

  const handleEditClick = (user) => {
    setCurrentUser(user);
    const formattedDob = user.dob ? new Date(user.dob).toISOString().split('T')[0] : '';
    setUserForm({
        firstName: user.firstName, lastName: user.lastName, email: user.email || '', phone: user.phone || '',
        dob: formattedDob, role: user.role, password: '', confirmPassword: ''
    });
    setErrors({ password: '', confirm: '', phone: '', email: '' }); 
    setShowEditModal(true);
  };

  const handleUpdateSubmit = async () => {
      const emailError = validateEmail(userForm.email);
      const phoneError = validatePhone(userForm.phone);
      if (emailError || phoneError) {
          setErrors(prev => ({ ...prev, email: emailError, phone: phoneError }));
          return;
      }
      try {
        await axios.put(`http://localhost:4000/api/users/${currentUser.userID}`, userForm, {
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

  // --- TRUCK HANDLERS ---
  const handleTruckSubmit = async () => {
      if(!truckForm.plateNo) return alert("Plate Number is required");
      try {
          await axios.post('http://localhost:4000/api/vehicles/create', truckForm, {
              headers: { Authorization: `Bearer ${token}` }
          });
          alert("Vehicle Added!");
          setShowTruckModal(false);
          setTruckForm({ plateNo: '', type: '6-Wheeler', status: 'Working' }); 
          fetchVehicles();
      } catch (e) { alert("Error adding vehicle"); }
  };

  const handleEditTruckClick = (vehicle) => {
      setCurrentVehicle(vehicle);
      setTruckForm({ plateNo: vehicle.plateNo, type: vehicle.type, status: vehicle.status });
      setShowEditTruckModal(true);
  };

  const handleUpdateTruck = async () => {
      try {
          await axios.put(`http://localhost:4000/api/vehicles/${currentVehicle.vehicleID}`, truckForm, {
              headers: { Authorization: `Bearer ${token}` }
          });
          alert("Vehicle Updated!");
          setShowEditTruckModal(false);
          fetchVehicles();
      } catch (e) { alert("Error updating vehicle"); }
  };

  const handleDeleteTruck = async (id) => {
      if(!window.confirm("Are you sure you want to delete this vehicle?")) return;
      try {
          await axios.delete(`http://localhost:4000/api/vehicles/${id}`, { headers: { Authorization: `Bearer ${token}` } });
          fetchVehicles();
      } catch (e) { alert("Error deleting vehicle"); }
  };

  const toggleTruckStatus = async (vehicle) => {
      const newStatus = vehicle.status === 'Working' ? 'Maintenance' : 'Working';
      try {
          await axios.put(`http://localhost:4000/api/vehicles/${vehicle.vehicleID}/status`, 
            { status: newStatus }, 
            { headers: { Authorization: `Bearer ${token}` } }
          );
          fetchVehicles();
      } catch (e) { alert("Error updating status"); }
  };

  // =========================================
  // RENDER TRUCK VIEW
  // =========================================
  if (activeTab === 'trucks') {
      const filteredVehicles = vehicles.filter(v => truckFilter === 'All' || v.status === truckFilter);
      const paginatedTrucks = filteredVehicles.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
      
      return (
        <div className="user-mgmt-container">
          <div className="header-actions">
              <div className="filter-group-inline">
                  <label>Filter Status:</label>
                  <select value={truckFilter} onChange={e => setTruckFilter(e.target.value)} className="role-filter-dropdown">
                    <option value="All">All Statuses</option>
                    <option value="Working">Working</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                  <div className="count-badge">{filteredVehicles.length} Vehicles</div>
              </div>
              <button className="create-user-btn" onClick={() => {
                  setTruckForm({ plateNo: '', type: '6-Wheeler', status: 'Working' });
                  setShowTruckModal(true);
              }}>+ Add Vehicle</button>
          </div>

          <div className="table-wrapper">
            <table className="user-table">
              <thead>
                <tr>
                  <th>Plate Number</th><th>Type</th><th>Status</th><th>Date Added</th><th style={{textAlign:'center'}}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTrucks.map(v => (
                  <tr key={v.vehicleID}>
                    <td style={{fontWeight:'700'}}>{v.plateNo || '-'}</td>
                    <td>{v.type}</td>
                    <td>
                        <span 
                            className="role-tag"
                            style={{
                                backgroundColor: v.status === 'Working' ? '#E8F5E9' : '#FFEBEE',
                                color: v.status === 'Working' ? '#2E7D32' : '#C62828',
                                cursor: 'pointer', border: '1px solid',
                                borderColor: v.status === 'Working' ? '#A5D6A7' : '#EF9A9A'
                            }}
                            onClick={() => toggleTruckStatus(v)}
                        >
                            {v.status}
                        </span>
                    </td>
                    <td>{new Date(v.dateCreated).toLocaleDateString()}</td>
                    <td className="action-cells">
                        <button className="icon-btn" onClick={() => handleEditTruckClick(v)}>
                            <svg viewBox="0 0 24 24" width="18" height="18"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                        </button>
                        <button className="icon-btn" onClick={() => handleDeleteTruck(v.vehicleID)}>
                            <svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                        </button>
                    </td>
                  </tr>
                ))}
                {renderGhostRows(paginatedTrucks.length, 5)}
              </tbody>
            </table>
          </div>

          {renderPagination(filteredVehicles.length)}

          {/* ADD TRUCK MODAL */}
          {showTruckModal && (
            <div className="modal-backdrop">
              <div className="modal-card">
                <h3>Add New Vehicle</h3>
                <label>Plate Number</label>
                <input type="text" value={truckForm.plateNo} onChange={e => setTruckForm({...truckForm, plateNo: e.target.value})} placeholder="ABC-1234" />
                <label>Vehicle Type</label>
                <select value={truckForm.type} onChange={e => setTruckForm({...truckForm, type: e.target.value})}>
                    <option value="6-Wheeler">6-Wheeler Truck</option>
                    <option value="10-Wheeler">10-Wheeler Truck</option>
                    <option value="L300">L300 Van</option>
                </select>
                <div className="modal-footer">
                    <button className="btn-cancel" onClick={() => setShowTruckModal(false)}>Cancel</button>
                    <button className="btn-save" onClick={handleTruckSubmit}>Save Vehicle</button>
                </div>
              </div>
            </div>
          )}

          {/* EDIT TRUCK MODAL */}
          {showEditTruckModal && (
            <div className="modal-backdrop">
              <div className="modal-card">
                <h3>Edit Vehicle</h3>
                <label>Plate Number</label>
                <input type="text" value={truckForm.plateNo} onChange={e => setTruckForm({...truckForm, plateNo: e.target.value})} />
                <label>Vehicle Type</label>
                <select value={truckForm.type} onChange={e => setTruckForm({...truckForm, type: e.target.value})}>
                    <option value="6-Wheeler">6-Wheeler Truck</option>
                    <option value="10-Wheeler">10-Wheeler Truck</option>
                    <option value="L300">L300 Van</option>
                </select>
                <label>Status</label>
                <select value={truckForm.status} onChange={e => setTruckForm({...truckForm, status: e.target.value})}>
                    <option value="Working">Working</option>
                    <option value="Maintenance">Maintenance</option>
                </select>
                <div className="modal-footer">
                    <button className="btn-cancel" onClick={() => setShowEditTruckModal(false)}>Cancel</button>
                    <button className="btn-save" onClick={handleUpdateTruck}>Update Vehicle</button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
  }

  // =========================================
  // RENDER USER VIEW
  // =========================================
  const filteredUsers = users.filter(user => roleFilter === 'All' || user.role.toLowerCase() === roleFilter.toLowerCase());
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  return (
    <div className="user-mgmt-container">
      <div className="header-actions">
          <div className="filter-group-inline">
              <label>Filter by Role:</label>
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="role-filter-dropdown">
                  <option value="All">All Roles</option>
                  <option value="Admin">Admin</option>
                  <option value="Operations">Operations</option>
                  <option value="Driver">Driver</option>
                  <option value="Helper">Helper</option>
              </select>
              <div className="count-badge">{filteredUsers.length} User{filteredUsers.length !== 1 ? 's' : ''}</div>
          </div>

          <button className="create-user-btn" onClick={() => {
              setUserForm({ firstName: '', lastName: '', email: '', phone: '', dob: '', role: 'Crew', password: '', confirmPassword: '' });
              setErrors({ password: '', confirm: '', phone: '', email: '' });
              setShowCreateModal(true);
          }}> + Create User </button>
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
            {paginatedUsers.length > 0 ? (
              <>
                {paginatedUsers.map(u => (
                  <tr key={u.userID}>
                    <td>{u.employeeID || 'N/A'}</td>
                    <td>{u.firstName} {u.lastName}</td>
                    <td>{u.phone || '-'}</td>
                    <td>{u.email || '-'}</td>
                    <td><span className={`role-tag ${u.role.toLowerCase()}`}>{u.role}</span></td>
                    <td>{new Date(u.dateCreated).toLocaleDateString()}</td>
                    <td className="action-cells">
                       <button className="icon-btn" onClick={() => handleEditClick(u)}>
                            <svg viewBox="0 0 24 24" width="18" height="18"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                       </button>
                       <button className="icon-btn" onClick={() => handleDelete(u.userID)}>
                            <svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                       </button>
                    </td>
                  </tr>
                ))}
                {renderGhostRows(paginatedUsers.length, 7)}
              </>
            ) : (
              <tr><td colSpan="7" className="empty-state">No users found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {renderPagination(filteredUsers.length)}

      {/* CREATE/EDIT USER MODALS (Remained the same) */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>Create New User</h3>
            <div className="row-inputs">
                <div className="col"><label>First Name</label><input type="text" name="firstName" value={userForm.firstName} onChange={handleUserInputChange} placeholder="John" /></div>
                <div className="col"><label>Last Name</label><input type="text" name="lastName" value={userForm.lastName} onChange={handleUserInputChange} placeholder="Doe" /></div>
            </div>
            <label>Email</label>
            <input type="email" name="email" value={userForm.email} onChange={handleUserInputChange} placeholder="john.doe@example.com" className={errors.email ? 'input-error' : ''} />
            {errors.email && <span className="error-text">{errors.email}</span>}
            <label>Phone Number (PH)</label>
            <input type="text" name="phone" value={userForm.phone} onChange={handleUserInputChange} placeholder="09xxxxxxxxx" className={errors.phone ? 'input-error' : ''} />
            {errors.phone && <span className="error-text">{errors.phone}</span>}
            <div className="row-inputs">
                <div className="col"><label>Date of Birth</label><input type="date" name="dob" value={userForm.dob} onChange={handleUserInputChange} /></div>
                <div className="col"><label>Role</label><select name="role" value={userForm.role} onChange={handleUserInputChange}><option value="Admin">Admin</option><option value="Operations">Operations</option><option value="Crew">Crew</option><option value="Driver">Driver</option><option value="Helper">Helper</option></select></div>
            </div>
            <label>Password</label>
            <input type="password" name="password" value={userForm.password} onChange={handleUserInputChange} className={errors.password ? 'input-error' : ''} />
            {errors.password && <span className="error-text">{errors.password}</span>}
            <label>Confirm Password</label>
            <input type="password" name="confirmPassword" value={userForm.confirmPassword} onChange={handleUserInputChange} className={errors.confirm ? 'input-error' : ''} />
            {errors.confirm && <span className="error-text">{errors.confirm}</span>}
            <div className="modal-footer">
                <button className="btn-cancel" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button className="btn-save" onClick={handleCreateSubmit} disabled={!!errors.password || !!errors.confirm || !!errors.phone || !!errors.email}>Save User</button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h3>Edit User</h3>
            <div className="row-inputs">
                <div className="col"><label>First Name</label><input type="text" name="firstName" value={userForm.firstName} onChange={handleUserInputChange} /></div>
                <div className="col"><label>Last Name</label><input type="text" name="lastName" value={userForm.lastName} onChange={handleUserInputChange} /></div>
            </div>
            <label>Email</label>
            <input type="email" name="email" value={userForm.email} onChange={handleUserInputChange} className={errors.email ? 'input-error' : ''} />
            {errors.email && <span className="error-text">{errors.email}</span>}
            <label>Phone Number</label>
            <input type="text" name="phone" value={userForm.phone} onChange={handleUserInputChange} className={errors.phone ? 'input-error' : ''} />
            {errors.phone && <span className="error-text">{errors.phone}</span>}
            <div className="row-inputs">
                <div className="col"><label>DOB</label><input type="date" name="dob" value={userForm.dob} onChange={handleUserInputChange} /></div>
                <div className="col"><label>Role</label><select name="role" value={userForm.role} onChange={handleUserInputChange}><option value="Admin">Admin</option><option value="Operations">Operations</option><option value="Driver">Driver</option><option value="Helper">Helper</option></select></div>
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