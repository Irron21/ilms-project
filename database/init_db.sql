-- 1. NUCLEAR RESET
DROP DATABASE IF EXISTS k2mac_ilms_db;
CREATE DATABASE k2mac_ilms_db;
USE k2mac_ilms_db;

-- ==========================================
-- A. CORE USERS & LOGINS
-- ==========================================

CREATE TABLE Users (
  userID INT NOT NULL AUTO_INCREMENT,
  firstName VARCHAR(100) NOT NULL,
  lastName VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL,
  phone VARCHAR(20) NULL,
  dob DATE NULL,
  dateCreated DATETIME DEFAULT CURRENT_TIMESTAMP,
  isArchived TINYINT(1) DEFAULT '0',
  PRIMARY KEY (userID)
);

CREATE TABLE UserLogins (
  loginID INT NOT NULL AUTO_INCREMENT,
  userID INT NOT NULL,
  employeeID VARCHAR(50) NOT NULL,
  hashedPassword VARCHAR(255) NOT NULL,
  activeToken TEXT NULL,
  isActive TINYINT(1) DEFAULT '1',
  PRIMARY KEY (loginID),
  UNIQUE INDEX employeeID (employeeID),
  FOREIGN KEY (userID) REFERENCES Users (userID) ON DELETE CASCADE
);

CREATE TABLE UserActivityLog (
  logID INT NOT NULL AUTO_INCREMENT,
  userID INT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  actionType VARCHAR(50) NULL,
  details VARCHAR(255) NULL,
  PRIMARY KEY (logID),
  FOREIGN KEY (userID) REFERENCES Users (userID)
);

-- ==========================================
-- B. ASSETS & OPERATIONS
-- ==========================================

CREATE TABLE Vehicles (
  vehicleID INT NOT NULL AUTO_INCREMENT,
  plateNo VARCHAR(20) NOT NULL,
  type VARCHAR(50) NULL,
  status ENUM('Working', 'Maintenance') DEFAULT 'Working',
  dateCreated DATETIME DEFAULT CURRENT_TIMESTAMP,
  isArchived TINYINT(1) DEFAULT '0',
  PRIMARY KEY (vehicleID),
  UNIQUE INDEX plateNo (plateNo)
);

CREATE TABLE Shipments (
  shipmentID INT NOT NULL,
  userID INT NULL,
  vehicleID INT NOT NULL,
  destName VARCHAR(150) NULL,
  destLocation VARCHAR(255) NULL,
  loadingDate DATE NULL,
  deliveryDate DATE NULL,
  creationTimestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  currentStatus VARCHAR(50) DEFAULT 'Pending',
  completedDropsCount INT DEFAULT 0,
  delayReason VARCHAR(255) NULL,
  isArchived TINYINT(1) DEFAULT '0',
  PRIMARY KEY (shipmentID),
  FOREIGN KEY (userID) REFERENCES Users (userID),
  FOREIGN KEY (vehicleID) REFERENCES Vehicles (vehicleID)
);

CREATE TABLE ShipmentDrops (
  dropID INT NOT NULL AUTO_INCREMENT,
  shipmentID INT NOT NULL,
  destName VARCHAR(150) NULL,
  destLocation VARCHAR(255) NULL,
  sequenceOrder INT DEFAULT 0,
  PRIMARY KEY (dropID),
  FOREIGN KEY (shipmentID) REFERENCES Shipments (shipmentID) ON DELETE CASCADE
);

CREATE TABLE ShipmentCrew (
  shipmentCrewID INT NOT NULL AUTO_INCREMENT,
  shipmentID INT NOT NULL,
  userID INT NOT NULL,
  role VARCHAR(50) NOT NULL,
  PRIMARY KEY (shipmentCrewID),
  FOREIGN KEY (shipmentID) REFERENCES Shipments (shipmentID) ON DELETE CASCADE,
  FOREIGN KEY (userID) REFERENCES Users (userID)
);

CREATE TABLE ShipmentStatusLog (
  statusLogID INT NOT NULL AUTO_INCREMENT,
  shipmentID INT NOT NULL,
  userID INT NOT NULL,
  dropID INT NULL,
  phaseName VARCHAR(50) NULL,
  status VARCHAR(50) NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  remarks VARCHAR(255) NULL, 
  PRIMARY KEY (statusLogID),
  FOREIGN KEY (shipmentID) REFERENCES Shipments (shipmentID),
  FOREIGN KEY (userID) REFERENCES Users (userID),
  FOREIGN KEY (dropID) REFERENCES ShipmentDrops (dropID) ON DELETE SET NULL
);

-- ==========================================
-- C. PAYROLL & FINANCIALS
-- ==========================================

CREATE TABLE PayrollPeriods (
  periodID INT NOT NULL AUTO_INCREMENT,
  periodName VARCHAR(100) NULL,
  startDate DATE NOT NULL,
  endDate DATE NOT NULL,
  status ENUM('OPEN', 'CLOSED') DEFAULT 'OPEN',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (periodID)
);

CREATE TABLE PayrollRates (
  rateID INT NOT NULL AUTO_INCREMENT,
  routeCluster VARCHAR(100) NOT NULL,
  vehicleType VARCHAR(50) DEFAULT 'AUV',
  driverBaseFee DECIMAL(10,2) DEFAULT '0.00',
  helperBaseFee DECIMAL(10,2) DEFAULT '0.00',
  foodAllowance DECIMAL(10,2) DEFAULT '350.00',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (rateID)
);

CREATE TABLE ShipmentPayroll (
  payrollID INT NOT NULL AUTO_INCREMENT,
  shipmentID INT NOT NULL,
  crewID INT NOT NULL,
  baseFee DECIMAL(10,2) NULL,
  allowance DECIMAL(10,2) NULL,
  periodID INT NULL,
  adjustmentAmount DECIMAL(10,2) DEFAULT '0.00',
  adjustmentReason VARCHAR(255) NULL,
  PRIMARY KEY (payrollID),
  FOREIGN KEY (shipmentID) REFERENCES Shipments (shipmentID) ON DELETE CASCADE,
  FOREIGN KEY (crewID) REFERENCES Users (userID),
  FOREIGN KEY (periodID) REFERENCES PayrollPeriods (periodID) ON DELETE SET NULL
);

CREATE TABLE PayrollAdjustments (
  adjustmentID INT NOT NULL AUTO_INCREMENT,
  userID INT NOT NULL,
  periodID INT NOT NULL,
  type ENUM('BONUS', 'DEDUCTION') NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  reason VARCHAR(255) NULL,
  status ENUM('ACTIVE', 'VOID') DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (adjustmentID),
  FOREIGN KEY (userID) REFERENCES Users (userID),
  FOREIGN KEY (periodID) REFERENCES PayrollPeriods (periodID) ON DELETE CASCADE
);

CREATE TABLE PayrollPayments (
  paymentID INT NOT NULL AUTO_INCREMENT,
  periodID INT NOT NULL,
  userID INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  paymentDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes VARCHAR(255) NULL,
  status ENUM('COMPLETED', 'VOID') DEFAULT 'COMPLETED',
  PRIMARY KEY (paymentID),
  FOREIGN KEY (periodID) REFERENCES PayrollPeriods (periodID) ON DELETE CASCADE,
  FOREIGN KEY (userID) REFERENCES Users (userID)
);

-- ==========================================
-- D. ANALYTICS
-- ==========================================

CREATE TABLE KPI_Monthly_Reports (
  reportID INT NOT NULL AUTO_INCREMENT,
  reportMonth DATETIME NULL,
  scoreBooking DECIMAL(5,2) NULL,
  scoreTruck DECIMAL(5,2) NULL,
  scoreCalltime DECIMAL(5,2) NULL,
  scoreDOT DECIMAL(5,2) NULL,
  scoreDelivery DECIMAL(5,2) NULL,
  scorePOD DECIMAL(5,2) NULL,
  rawFailureData JSON NULL,
  is_archived TINYINT(1) DEFAULT '0',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (reportID)
);

-- ==========================================
-- E. SEED DATA
-- ==========================================

-- 1. Users
INSERT INTO Users (userID, firstName, lastName, role) VALUES 
(1, 'System', 'Admin', 'Admin'),
(2, 'Ops', 'Manager', 'Operations'),
(3, 'Juan', 'Driver', 'Driver'),
(4, 'Pedro', 'Helper', 'Helper'),
(5, 'Mark', 'Trucker', 'Driver'),
(6, 'Jose', 'Porter', 'Helper');

-- 2. Logins
INSERT INTO UserLogins (userID, employeeID, hashedPassword, isActive) VALUES 
(1, 'Admin', '$2b$10$ebU6j762YqtNM1OIIqrMKOuGvZdvE5jjIbgOK00ISD7vT1LPSk.Z6', 1),
(2, 'Ops', '$2b$10$ebU6j762YqtNM1OIIqrMKOuGvZdvE5jjIbgOK00ISD7vT1LPSk.Z6', 1),
(3, 'DRV-001', '$2b$10$ebU6j762YqtNM1OIIqrMKOuGvZdvE5jjIbgOK00ISD7vT1LPSk.Z6', 1),
(4, 'HLP-001', '$2b$10$ebU6j762YqtNM1OIIqrMKOuGvZdvE5jjIbgOK00ISD7vT1LPSk.Z6', 1);

-- 3. Vehicles
INSERT INTO Vehicles (vehicleID, plateNo, type, status) VALUES 
(1, 'ABC-1234', 'AUV', 'Working'),
(2, 'XYZ-9876', '6WH', 'Working'),
(3, 'UV-0001', 'AUV', 'Maintenance'),
(4, 'TRK-5555', '6WH', 'Working');

-- 4. Rates
INSERT INTO PayrollRates (routeCluster, vehicleType, driverBaseFee, helperBaseFee, foodAllowance) VALUES
('Antipolo', 'AUV', 600.00, 400.00, 350.00),
('Antipolo', 'H100', 600.00, 400.00, 350.00),
('Antipolo', '6WH', 800.00, 600.00, 350.00),
('Taguig', 'AUV', 600.00, 400.00, 350.00),
('Taguig', '6WH', 800.00, 600.00, 350.00),
('Pasig', 'AUV', 600.00, 400.00, 350.00),
('Pasig', 'FWD', 1000.00, 700.00, 350.00),
('Quezon', 'AUV', 600.00, 400.00, 350.00),
('Quezon', '6WH', 800.00, 600.00, 350.00),
('Manila', 'AUV', 600.00, 400.00, 350.00),
('Manila', '6WH', 800.00, 600.00, 350.00),
('Makati', 'AUV', 600.00, 400.00, 350.00),
('Muntinlupa', 'AUV', 600.00, 400.00, 350.00),
('Muntinlupa', 'FWD', 1000.00, 700.00, 350.00),
('Mandaluyong', 'AUV', 600.00, 400.00, 350.00),
('Valenzuela', 'AUV', 600.00, 400.00, 350.00),
('Valenzuela', '6WH', 800.00, 600.00, 350.00),
('Malabon', 'AUV', 600.00, 400.00, 350.00),
('Malabon', 'H100', 620.00, 420.00, 350.00),
('Paranaque', 'AUV', 600.00, 400.00, 350.00),
('Paranaque', '6WH', 800.00, 600.00, 350.00),
('Paranaque', 'FWD', 1000.00, 800.00, 350.00),
('Las Pinas', 'AUV', 600.00, 400.00, 350.00),
('Caloocan', 'AUV', 600.00, 400.00, 350.00),
('Marikina', 'AUV', 600.00, 400.00, 350.00),
('Rizal', 'AUV', 600.00, 400.00, 350.00),
('Taytay', 'AUV', 600.00, 400.00, 350.00),
('Montalban', 'AUV', 600.00, 400.00, 350.00),
('Cavite', 'AUV', 700.00, 500.00, 350.00),
('Cavite', 'H100', 700.00, 500.00, 350.00),
('Cavite', '6WH', 800.00, 600.00, 350.00),
('Cavite', 'FWD', 1000.00, 700.00, 350.00),
('Imus', 'AUV', 700.00, 500.00, 350.00),
('Dasmarinas', 'AUV', 700.00, 500.00, 350.00),
('Silang', 'AUV', 700.00, 500.00, 350.00),
('Silang', 'FWD', 1000.00, 700.00, 350.00),
('Laguna', 'AUV', 700.00, 500.00, 350.00),
('Laguna', 'H100', 620.00, 420.00, 350.00),
('Laguna', 'FWD', 1000.00, 700.00, 350.00),
('Sta Rosa', 'AUV', 700.00, 500.00, 350.00),
('Binan', 'AUV', 700.00, 500.00, 350.00),
('San Pedro', 'AUV', 700.00, 500.00, 350.00),
('Cabuyao', 'AUV', 700.00, 500.00, 350.00),
('Calamba', 'AUV', 700.00, 500.00, 350.00),
('Batangas', 'AUV', 800.00, 500.00, 350.00),
('Batangas', 'H100', 800.00, 500.00, 350.00),
('Batangas', '6WH', 1200.00, 800.00, 350.00),
('Sto Tomas', 'AUV', 700.00, 500.00, 350.00),
('Sto Tomas', '6WH', 800.00, 600.00, 350.00),
('Lipa', 'AUV', 800.00, 500.00, 350.00),
('Tanauan', 'AUV', 700.00, 500.00, 350.00),
('Bulacan', 'AUV', 700.00, 500.00, 350.00),
('Bulacan', 'H100', 720.00, 470.00, 350.00),
('Pampanga', 'AUV', 900.00, 600.00, 350.00),
('Pampanga', '6WH', 1200.00, 800.00, 350.00),
('Tarlac', 'AUV', 1200.00, 800.00, 350.00),
('Tarlac', 'FWD', 1800.00, 1000.00, 500.00),
('Zambales', 'AUV', 1500.00, 1000.00, 400.00),
('Subic', 'AUV', 1500.00, 1000.00, 400.00),
('Cabanatuan', 'AUV', 1300.00, 900.00, 400.00),
('Pangasinan', 'AUV', 1800.00, 1200.00, 500.00),
('Pangasinan', 'FWD', 2000.00, 1200.00, 500.00),
('Ilocos', '6WH', 2500.00, 1500.00, 600.00),
('Ilocos Sur', '6WH', 2000.00, 1200.00, 600.00),
('Baguio', 'AUV', 1800.00, 1200.00, 500.00),
('La Union', 'AUV', 1800.00, 1200.00, 500.00),
('Isabela', 'AUV', 3000.00, 1800.00, 600.00),
('Tuguegarao', 'AUV', 3200.00, 2000.00, 600.00),
('Bicol', '6WH', 3500.00, 2000.00, 700.00),
('Cam Sur', 'AUV', 3000.00, 1800.00, 600.00),
('Pili', 'AUV', 3000.00, 1800.00, 600.00),
('Legazpi', 'AUV', 3500.00, 2000.00, 700.00),
('Naga', 'AUV', 3000.00, 1800.00, 600.00),
('Lucena', 'AUV', 1000.00, 700.00, 350.00),
('Candelaria', 'AUV', 1000.00, 700.00, 350.00);

-- 5. Periods
INSERT INTO PayrollPeriods (periodName, startDate, endDate, status) VALUES 
('January 1-15, 2026',  '2026-01-01', '2026-01-15', 'CLOSED'),
('January 16-31, 2026', '2026-01-16', '2026-01-31', 'CLOSED'),
('February 1-15, 2026',  '2026-02-01', '2026-02-15', 'OPEN'),
('February 16-28, 2026', '2026-02-16', '2026-02-28', 'OPEN'),
('March 1-15, 2026',  '2026-03-01', '2026-03-15', 'OPEN'),
('March 16-31, 2026', '2026-03-16', '2026-03-31', 'OPEN'),
('April 1-15, 2026',  '2026-04-01', '2026-04-15', 'OPEN'),
('April 16-30, 2026', '2026-04-16', '2026-04-30', 'OPEN'),
('May 1-15, 2026',  '2026-05-01', '2026-05-15', 'OPEN'),
('May 16-31, 2026', '2026-05-16', '2026-05-31', 'OPEN'),
('June 1-15, 2026',  '2026-06-01', '2026-06-15', 'OPEN'),
('June 16-30, 2026', '2026-06-16', '2026-06-30', 'OPEN'),
('July 1-15, 2026',  '2026-07-01', '2026-07-15', 'OPEN'),
('July 16-31, 2026', '2026-07-16', '2026-07-31', 'OPEN'),
('August 1-15, 2026',  '2026-08-01', '2026-08-15', 'OPEN'),
('August 16-31, 2026', '2026-08-16', '2026-08-31', 'OPEN'),
('September 1-15, 2026',  '2026-09-01', '2026-09-15', 'OPEN'),
('September 16-30, 2026', '2026-09-16', '2026-09-30', 'OPEN'),
('October 1-15, 2026',  '2026-10-01', '2026-10-15', 'OPEN'),
('October 16-31, 2026', '2026-10-16', '2026-10-31', 'OPEN'),
('November 1-15, 2026',  '2026-11-01', '2026-11-15', 'OPEN'),
('November 16-30, 2026', '2026-11-16', '2026-11-30', 'OPEN'),
('December 1-15, 2026',  '2026-12-01', '2026-12-15', 'OPEN'),
('December 16-31, 2026', '2026-12-16', '2026-12-31', 'OPEN');

-- 7. KPI Data
INSERT INTO KPI_Monthly_Reports (reportMonth, scoreBooking, scoreTruck, scoreCalltime, scoreDOT, scoreDelivery, scorePOD) VALUES
('2025-11-01', 95.5, 98.0, 92.0, 100.0, 90.0, 88.0),
('2025-12-01', 97.0, 99.0, 95.0, 99.0, 92.5, 91.0),
('2026-01-01', 94.0, 96.0, 89.0, 98.0, 88.0, 85.0);

-- 8. Shipments
INSERT INTO Shipments (shipmentID, destName, destLocation, vehicleID, loadingDate, deliveryDate, currentStatus, delayReason, userID, creationTimestamp) VALUES (908442, 'UAT Delivery - Pampanga', 'Pampanga', 1, '2026-02-09', '2026-02-14', 'Pending', 'Documentation Issue', 3, '2026-02-12 14:11:29');
INSERT INTO ShipmentCrew (shipmentID, userID, role) VALUES (908442, 3, 'Driver');
INSERT INTO ShipmentCrew (shipmentID, userID, role) VALUES (908442, 4, 'Helper');
INSERT INTO ShipmentStatusLog (shipmentID, userID, phaseName, status, timestamp) VALUES (908442, 3, 'Creation', 'Created', '2026-02-12 14:11:29');

INSERT INTO Shipments (shipmentID, destName, destLocation, vehicleID, loadingDate, deliveryDate, currentStatus, delayReason, userID, creationTimestamp) VALUES (660805, 'UAT Delivery - Lucena', 'Lucena', 1, '2026-02-07', '2026-02-11', 'Loaded', 'Client Warehouse Closed', 3, '2026-02-12 14:11:29');
INSERT INTO ShipmentCrew (shipmentID, userID, role) VALUES (660805, 3, 'Driver');
INSERT INTO ShipmentCrew (shipmentID, userID, role) VALUES (660805, 4, 'Helper');
INSERT INTO ShipmentStatusLog (shipmentID, userID, phaseName, status, timestamp) VALUES (660805, 3, 'Creation', 'Created', '2026-02-12 14:11:29');

INSERT INTO Shipments (shipmentID, destName, destLocation, vehicleID, loadingDate, deliveryDate, currentStatus, delayReason, userID, creationTimestamp) VALUES (766082, 'UAT Delivery - Cavite', 'Cavite', 1, '2026-02-13', '2026-02-16', 'Pending', NULL, 3, '2026-02-12 14:11:29');
INSERT INTO ShipmentCrew (shipmentID, userID, role) VALUES (766082, 3, 'Driver');
INSERT INTO ShipmentCrew (shipmentID, userID, role) VALUES (766082, 4, 'Helper');
INSERT INTO ShipmentStatusLog (shipmentID, userID, phaseName, status, timestamp) VALUES (766082, 3, 'Creation', 'Created', '2026-02-12 14:11:29');

INSERT INTO Shipments (shipmentID, destName, destLocation, vehicleID, loadingDate, deliveryDate, currentStatus, delayReason, userID, creationTimestamp) VALUES (450388, 'UAT Delivery - Rizal', 'Rizal', 1, '2026-02-13', '2026-02-17', 'Loaded', NULL, 3, '2026-02-12 14:11:29');
INSERT INTO ShipmentCrew (shipmentID, userID, role) VALUES (450388, 3, 'Driver');
INSERT INTO ShipmentCrew (shipmentID, userID, role) VALUES (450388, 4, 'Helper');
INSERT INTO ShipmentStatusLog (shipmentID, userID, phaseName, status, timestamp) VALUES (450388, 3, 'Creation', 'Created', '2026-02-12 14:11:29');

INSERT INTO Shipments (shipmentID, destName, destLocation, vehicleID, loadingDate, deliveryDate, currentStatus, delayReason, userID, creationTimestamp) VALUES (764804, 'UAT Delivery - Taguig', 'Taguig', 1, '2026-02-17', '2026-02-22', 'Pending', NULL, 3, '2026-02-12 14:11:29');
INSERT INTO ShipmentCrew (shipmentID, userID, role) VALUES (764804, 3, 'Driver');
INSERT INTO ShipmentCrew (shipmentID, userID, role) VALUES (764804, 4, 'Helper');
INSERT INTO ShipmentStatusLog (shipmentID, userID, phaseName, status, timestamp) VALUES (764804, 3, 'Creation', 'Created', '2026-02-12 14:11:29');

INSERT INTO Shipments (shipmentID, destName, destLocation, vehicleID, loadingDate, deliveryDate, currentStatus, delayReason, userID, creationTimestamp) VALUES (815373, 'UAT Delivery - Ilocos', 'Ilocos', 1, '2026-02-02', '2026-02-04', 'Completed', NULL, 3, '2026-02-12 14:11:29');
INSERT INTO ShipmentCrew (shipmentID, userID, role) VALUES (815373, 3, 'Driver');
INSERT INTO ShipmentCrew (shipmentID, userID, role) VALUES (815373, 4, 'Helper');
INSERT INTO ShipmentStatusLog (shipmentID, userID, phaseName, status, timestamp) VALUES (815373, 3, 'Creation', 'Created', '2026-02-12 14:11:29');
