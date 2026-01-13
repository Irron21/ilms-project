-- 1. Create and Select the Database
CREATE DATABASE IF NOT EXISTS k2mac_ilms_db;
USE k2mac_ilms_db;

-- 2. Create Users Table
CREATE TABLE Users (
    userID INT AUTO_INCREMENT PRIMARY KEY,
    firstName VARCHAR(100) NOT NULL,
    lastName VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL -- 'Admin', 'Operations', 'Driver', 'Helper'
);

-- 3. Create UserLogins Table
CREATE TABLE UserLogins (
    loginID INT AUTO_INCREMENT PRIMARY KEY,
    userID INT NOT NULL,
    employeeID VARCHAR(50) UNIQUE NOT NULL,
    hashedPassword VARCHAR(255) NOT NULL,
    FOREIGN KEY (userID) REFERENCES Users(userID)
);

-- 4. Create Vehicles Table
CREATE TABLE Vehicles (
    vehicleID INT AUTO_INCREMENT PRIMARY KEY,
    plateNo VARCHAR(20) UNIQUE NOT NULL,
    type VARCHAR(50) -- '10-wheeler', '6-wheeler', etc.
);

-- 5. Create Clients Table
CREATE TABLE Clients (
    clientID INT AUTO_INCREMENT PRIMARY KEY,
    clientName VARCHAR(150) NOT NULL,
    defaultLocation VARCHAR(255)
);

-- 6. Create Shipments Table (The central table)
CREATE TABLE Shipments (
    shipmentID INT AUTO_INCREMENT PRIMARY KEY,
    operationsUserID INT, -- Who created it
    clientID INT NOT NULL,
    vehicleID INT NOT NULL,
    destName VARCHAR(150),
    destLocation VARCHAR(255),
    creationTimestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    currentStatus VARCHAR(20) DEFAULT 'Pending', -- 'Pending', 'In-Progress', 'Completed'
    compensationRate DECIMAL(10,2),
    FOREIGN KEY (operationsUserID) REFERENCES Users(userID),
    FOREIGN KEY (clientID) REFERENCES Clients(clientID),
    FOREIGN KEY (vehicleID) REFERENCES Vehicles(vehicleID)
);

-- 7. Create ShipmentCrew Junction Table
CREATE TABLE ShipmentCrew (
    shipmentCrewID INT AUTO_INCREMENT PRIMARY KEY,
    shipmentID INT NOT NULL,
    userID INT NOT NULL, -- The crew member (Driver/Helper)
    FOREIGN KEY (shipmentID) REFERENCES Shipments(shipmentID),
    FOREIGN KEY (userID) REFERENCES Users(userID)
);

-- 8. Create KPI Definitions (Lookup table)
CREATE TABLE KPI_Definitions (
    kpiID INT AUTO_INCREMENT PRIMARY KEY,
    kpiName VARCHAR(100) NOT NULL,
    description VARCHAR(255)
);

-- 9. Create KPI Upload Log
CREATE TABLE KPI_Upload_Log (
    uploadID INT AUTO_INCREMENT PRIMARY KEY,
    userID INT NOT NULL, -- Who uploaded the file
    fileName VARCHAR(255),
    uploadTimestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userID) REFERENCES Users(userID)
);

-- 10. Create KPI Aggregate Values (For dashboard charts)
CREATE TABLE KPI_Aggregate_Values (
    valueID INT AUTO_INCREMENT PRIMARY KEY,
    kpiID INT NOT NULL,
    uploadID INT NOT NULL,
    date DATE,
    value DECIMAL(5,2), -- e.g., 97.50
    FOREIGN KEY (kpiID) REFERENCES KPI_Definitions(kpiID),
    FOREIGN KEY (uploadID) REFERENCES KPI_Upload_Log(uploadID)
);

-- 11. Create Shipment KPI Events (Failures/Exceptions)
CREATE TABLE Shipment_KPI_Events (
    eventID INT AUTO_INCREMENT PRIMARY KEY,
    shipmentID INT NOT NULL,
    kpiID INT NOT NULL,
    actualValue VARCHAR(50), -- e.g., "3.5 Hours"
    targetValue VARCHAR(50), -- e.g., "2 Hours"
    FOREIGN KEY (shipmentID) REFERENCES Shipments(shipmentID),
    FOREIGN KEY (kpiID) REFERENCES KPI_Definitions(kpiID)
);

-- 12. Create Shipment Status Log (Audit trail for the mobile app)
CREATE TABLE ShipmentStatusLog (
    statusLogID INT AUTO_INCREMENT PRIMARY KEY,
    shipmentID INT NOT NULL,
    userID INT NOT NULL, -- Who clicked the button
    phaseName VARCHAR(50), -- 'Arrival', 'Start Unload', etc.
    status VARCHAR(50),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shipmentID) REFERENCES Shipments(shipmentID),
    FOREIGN KEY (userID) REFERENCES Users(userID)
);

-- 13. Create Payroll Periods
CREATE TABLE PayrollPeriods (
    periodID INT AUTO_INCREMENT PRIMARY KEY,
    startDate DATE NOT NULL,
    endDate DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'Open' -- 'Open', 'Processed', 'Paid'
);

-- 14. Create Payroll Reports (The calculated results)
CREATE TABLE PayrollReports (
    reportID INT AUTO_INCREMENT PRIMARY KEY,
    periodID INT NOT NULL,
    userID INT NOT NULL, -- The employee being paid
    totalJobs INT,
    suggestedCompensation DECIMAL(10,2),
    FOREIGN KEY (periodID) REFERENCES PayrollPeriods(periodID),
    FOREIGN KEY (userID) REFERENCES Users(userID)
);

-- 15. Create User Activity Log (Auditing)
CREATE TABLE UserActivityLog (
    logID INT AUTO_INCREMENT PRIMARY KEY,
    userID INT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    actionType VARCHAR(50), -- 'LOGIN', 'CREATE_SHIPMENT', etc.
    details VARCHAR(255),
    FOREIGN KEY (userID) REFERENCES Users(userID)
);

-- OPTIONAL: Insert some dummy data to test the connection immediately
INSERT INTO Users (firstName, lastName, role) VALUES ('Admin', 'User', 'Admin');
INSERT INTO KPI_Definitions (kpiName, description) VALUES ('DwellTime Compliance', 'Time spent at location'), ('POD Compliance', 'Proof of delivery submission');

-- Create a dummy client
INSERT INTO Clients (clientName, defaultLocation) VALUES ('ABC Logistics Hub', 'Calamba, Laguna');
-- Create a dummy vehicle
INSERT INTO Vehicles (plateNo, type) VALUES ('NDR 1234', '10-wheeler');
-- Create a dummy shipment
INSERT INTO Shipments (clientID, vehicleID, destName, destLocation, currentStatus) 
VALUES (1, 1, 'GMA Warehouse', 'GMA, Cavite', 'Pending');

-- "Operations" assigning a new job to the crew
INSERT INTO Shipments (
    clientID, 
    vehicleID, 
    destName, 
    destLocation, 
    currentStatus, 
    creationTimestamp
) 
VALUES (
    1, -- Assuming Client ID 1 exists (ABC Logistics)
    1, -- Assuming Vehicle ID 1 exists
    'SM Mall of Asia', 
    'Pasay City, Metro Manila', 
    'Pending', -- 'Pending' makes the first button (Arrival) turn Yellow
    NOW()
);

SELECT * FROM Shipments;
-- Assign User #1 (The Driver) to Shipment #1 (The Shipment)
INSERT INTO ShipmentCrew (shipmentID, userID) VALUES (11, 2);

SET SQL_SAFE_UPDATES = 0;


-- Force any shipment stuck on "Departure" to become "Completed"
UPDATE Shipments 
SET currentStatus = 'Completed' 
WHERE currentStatus = 'Departure';

-- 1. Create the Person first in 'Users'
INSERT INTO Users (firstName, lastName, role) 
VALUES ('Juan', 'Dela Cruz', 'Driver');

-- 2. Create the Login Credentials for that person in 'UserLogins'
-- Note: We assume the userID generated above is '1'. 
-- If you already have users, check the ID first!
INSERT INTO UserLogins (userID, employeeID, hashedPassword) 
VALUES (
    2, -- This MUST match the userID from the step above
    'crew1', 
    '$2a$10$Fb.8.j.j.j.j.j.j.j.j.u5G.j.j.j.j.j.j.j.j.j' -- This is "password123"
);
UPDATE UserLogins 
SET userID = '2' 
WHERE employeeID = 'crew1';

SELECT * FROM ShipmentStatusLog;
