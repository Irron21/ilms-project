-- MySQL dump 10.13  Distrib 8.0.45, for Linux (aarch64)
--
-- Host: localhost    Database: k2mac_ilms_db
-- ------------------------------------------------------
-- Server version	8.0.45

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `EmployeeDeductions`
--

DROP TABLE IF EXISTS `EmployeeDeductions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `EmployeeDeductions` (
  `deductionID` int NOT NULL AUTO_INCREMENT,
  `userID` int NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `deductionDate` datetime DEFAULT CURRENT_TIMESTAMP,
  `reason` varchar(255) DEFAULT NULL,
  `status` varchar(20) DEFAULT 'UNPAID',
  `payrollReferenceID` int DEFAULT NULL,
  PRIMARY KEY (`deductionID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `EmployeeDeductions`
--

LOCK TABLES `EmployeeDeductions` WRITE;
/*!40000 ALTER TABLE `EmployeeDeductions` DISABLE KEYS */;
/*!40000 ALTER TABLE `EmployeeDeductions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `KPI_Monthly_Reports`
--

DROP TABLE IF EXISTS `KPI_Monthly_Reports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `KPI_Monthly_Reports` (
  `reportID` int NOT NULL AUTO_INCREMENT,
  `reportMonth` datetime DEFAULT NULL,
  `scoreBooking` decimal(5,2) DEFAULT NULL,
  `scoreTruck` decimal(5,2) DEFAULT NULL,
  `scoreCalltime` decimal(5,2) DEFAULT NULL,
  `scoreDOT` decimal(5,2) DEFAULT NULL,
  `scoreDelivery` decimal(5,2) DEFAULT NULL,
  `scorePOD` decimal(5,2) DEFAULT NULL,
  `rawFailureData` json DEFAULT NULL,
  `uploadTimestamp` datetime DEFAULT CURRENT_TIMESTAMP,
  `is_archived` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`reportID`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `KPI_Monthly_Reports`
--

LOCK TABLES `KPI_Monthly_Reports` WRITE;
/*!40000 ALTER TABLE `KPI_Monthly_Reports` DISABLE KEYS */;
INSERT INTO `KPI_Monthly_Reports` VALUES (1,'2025-11-01 00:00:00',95.50,98.00,92.00,100.00,90.00,88.00,NULL,'2026-02-01 15:38:57',0,'2026-02-01 15:38:57'),(2,'2025-12-01 00:00:00',97.00,99.00,95.00,99.00,92.50,91.00,NULL,'2026-02-01 15:38:57',0,'2026-02-01 15:38:57'),(3,'2026-01-01 00:00:00',94.00,96.00,89.00,98.00,88.00,85.00,NULL,'2026-02-01 15:38:57',0,'2026-02-01 15:38:57'),(4,'2028-12-01 00:00:00',94.93,96.48,96.61,93.78,100.00,98.99,'[{\"reason\": \"Crew issue - sudden leaving of crew\", \"category\": \"Booking\"}, {\"reason\": \"Crew issue - sudden leaving of crew\", \"category\": \"Truck\"}, {\"reason\": \"Nakatulog at napasarap ang tulog ng crew -hindi nagising sa alarm\", \"category\": \"CallTime\"}, {\"reason\": \"Nakatulog at napasarap ang tulog ng crew -hindi nagising sa alarm\", \"category\": \"DOT\"}, {\"reason\": \"Driver not feeling well during travel\", \"category\": \"Delivery\"}, {\"reason\": \"Rejections not reported properly during delivery\", \"category\": \"POD\"}, {\"reason\": \"Truck turn around\", \"category\": \"Booking\"}, {\"reason\": \"Truck turn around\", \"category\": \"Truck\"}, {\"reason\": \"Nagka emergency ang crew\", \"category\": \"CallTime\"}, {\"reason\": \"Nagka emergency ang crew\", \"category\": \"DOT\"}, {\"reason\": \"Truck turn around\", \"category\": \"CallTime\"}, {\"reason\": \"Truck turn around\", \"category\": \"DOT\"}, {\"reason\": \"Lacking qty in GRS vs. DN\", \"category\": \"POD\"}]','2026-02-02 03:24:59',0,'2026-02-02 03:24:59');
/*!40000 ALTER TABLE `KPI_Monthly_Reports` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `PayrollAdjustments`
--

DROP TABLE IF EXISTS `PayrollAdjustments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `PayrollAdjustments` (
  `adjustmentID` int NOT NULL AUTO_INCREMENT,
  `userID` int NOT NULL,
  `periodID` int NOT NULL,
  `type` enum('BONUS','DEDUCTION') NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `status` enum('ACTIVE','VOID') DEFAULT 'ACTIVE',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`adjustmentID`),
  KEY `userID` (`userID`),
  KEY `periodID` (`periodID`),
  CONSTRAINT `PayrollAdjustments_ibfk_1` FOREIGN KEY (`userID`) REFERENCES `Users` (`userID`),
  CONSTRAINT `PayrollAdjustments_ibfk_2` FOREIGN KEY (`periodID`) REFERENCES `PayrollPeriods` (`periodID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `PayrollAdjustments`
--

LOCK TABLES `PayrollAdjustments` WRITE;
/*!40000 ALTER TABLE `PayrollAdjustments` DISABLE KEYS */;
INSERT INTO `PayrollAdjustments` VALUES (1,4,3,'DEDUCTION',1000.00,'Advance','ACTIVE','2026-02-02 03:21:51'),(2,4,4,'DEDUCTION',1000.00,'Balance from Period #3','ACTIVE','2026-02-02 03:22:12');
/*!40000 ALTER TABLE `PayrollAdjustments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `PayrollPayments`
--

DROP TABLE IF EXISTS `PayrollPayments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `PayrollPayments` (
  `paymentID` int NOT NULL AUTO_INCREMENT,
  `periodID` int NOT NULL,
  `userID` int NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `paymentDate` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `notes` varchar(255) DEFAULT NULL,
  `referenceNumber` varchar(100) DEFAULT NULL,
  `status` enum('COMPLETED','VOID') DEFAULT 'COMPLETED',
  PRIMARY KEY (`paymentID`),
  KEY `periodID` (`periodID`),
  KEY `userID` (`userID`),
  CONSTRAINT `PayrollPayments_ibfk_1` FOREIGN KEY (`periodID`) REFERENCES `PayrollPeriods` (`periodID`) ON DELETE CASCADE,
  CONSTRAINT `PayrollPayments_ibfk_2` FOREIGN KEY (`userID`) REFERENCES `Users` (`userID`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `PayrollPayments`
--

LOCK TABLES `PayrollPayments` WRITE;
/*!40000 ALTER TABLE `PayrollPayments` DISABLE KEYS */;
INSERT INTO `PayrollPayments` VALUES (1,3,3,1.00,'2026-02-02 03:08:29','Partial Payment',NULL,'COMPLETED'),(2,3,3,54899.00,'2026-02-02 03:08:33','Partial Payment',NULL,'COMPLETED'),(3,3,4,3600.00,'2026-02-02 03:22:07','Partial Payment',NULL,'COMPLETED'),(4,3,6,9050.00,'2026-02-02 03:22:29','Partial Payment',NULL,'COMPLETED');
/*!40000 ALTER TABLE `PayrollPayments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `PayrollPeriods`
--

DROP TABLE IF EXISTS `PayrollPeriods`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `PayrollPeriods` (
  `periodID` int NOT NULL AUTO_INCREMENT,
  `periodName` varchar(100) DEFAULT NULL,
  `startDate` date NOT NULL,
  `endDate` date NOT NULL,
  `status` enum('OPEN','CLOSED') DEFAULT 'OPEN',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`periodID`),
  KEY `idx_period_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `PayrollPeriods`
--

LOCK TABLES `PayrollPeriods` WRITE;
/*!40000 ALTER TABLE `PayrollPeriods` DISABLE KEYS */;
INSERT INTO `PayrollPeriods` VALUES (1,'January 1-15, 2026','2026-01-01','2026-01-15','CLOSED','2026-02-01 15:46:29'),(2,'January 16-31, 2026','2026-01-16','2026-01-31','OPEN','2026-02-01 15:46:29'),(3,'February 1-15, 2026','2026-02-01','2026-02-15','OPEN','2026-02-01 15:46:29'),(4,'February 16-28, 2026','2026-02-16','2026-02-28','OPEN','2026-02-01 15:46:29'),(5,'March 1-15, 2026','2026-03-01','2026-03-15','OPEN','2026-02-01 15:46:29'),(6,'March 16-31, 2026','2026-03-16','2026-03-31','OPEN','2026-02-01 15:46:29'),(7,'April 1-15, 2026','2026-04-01','2026-04-15','OPEN','2026-02-01 15:46:29'),(8,'April 16-30, 2026','2026-04-16','2026-04-30','OPEN','2026-02-01 15:46:29'),(9,'May 1-15, 2026','2026-05-01','2026-05-15','OPEN','2026-02-01 15:46:29'),(10,'May 16-31, 2026','2026-05-16','2026-05-31','OPEN','2026-02-01 15:46:29'),(11,'June 1-15, 2026','2026-06-01','2026-06-15','OPEN','2026-02-01 15:46:29'),(12,'June 16-30, 2026','2026-06-16','2026-06-30','OPEN','2026-02-01 15:46:29'),(13,'July 1-15, 2026','2026-07-01','2026-07-15','OPEN','2026-02-01 15:46:29'),(14,'July 16-31, 2026','2026-07-16','2026-07-31','OPEN','2026-02-01 15:46:29'),(15,'August 1-15, 2026','2026-08-01','2026-08-15','OPEN','2026-02-01 15:46:29'),(16,'August 16-31, 2026','2026-08-16','2026-08-31','OPEN','2026-02-01 15:46:29'),(17,'September 1-15, 2026','2026-09-01','2026-09-15','OPEN','2026-02-01 15:46:29'),(18,'September 16-30, 2026','2026-09-16','2026-09-30','OPEN','2026-02-01 15:46:29'),(19,'October 1-15, 2026','2026-10-01','2026-10-15','OPEN','2026-02-01 15:46:29'),(20,'October 16-31, 2026','2026-10-16','2026-10-31','OPEN','2026-02-01 15:46:29'),(21,'November 1-15, 2026','2026-11-01','2026-11-15','OPEN','2026-02-01 15:46:29'),(22,'November 16-30, 2026','2026-11-16','2026-11-30','OPEN','2026-02-01 15:46:29'),(23,'December 1-15, 2026','2026-12-01','2026-12-15','OPEN','2026-02-01 15:46:29'),(24,'December 16-31, 2026','2026-12-16','2026-12-31','OPEN','2026-02-01 15:46:29');
/*!40000 ALTER TABLE `PayrollPeriods` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `PayrollRates`
--

DROP TABLE IF EXISTS `PayrollRates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `PayrollRates` (
  `rateID` int NOT NULL AUTO_INCREMENT,
  `routeCluster` varchar(100) NOT NULL,
  `vehicleType` varchar(50) DEFAULT 'AUV',
  `driverBaseFee` decimal(10,2) DEFAULT '0.00',
  `helperBaseFee` decimal(10,2) DEFAULT '0.00',
  `foodAllowance` decimal(10,2) DEFAULT '350.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`rateID`),
  KEY `idx_rates_lookup` (`routeCluster`,`vehicleType`)
) ENGINE=InnoDB AUTO_INCREMENT=76 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `PayrollRates`
--

LOCK TABLES `PayrollRates` WRITE;
/*!40000 ALTER TABLE `PayrollRates` DISABLE KEYS */;
INSERT INTO `PayrollRates` VALUES (1,'Antipolo','AUV',600.00,400.00,350.00,'2026-02-02 07:07:24'),(2,'Antipolo','H100',600.00,400.00,350.00,'2026-02-02 07:07:24'),(3,'Antipolo','6WH',800.00,600.00,350.00,'2026-02-02 07:07:24'),(4,'Taguig','AUV',600.00,400.00,350.00,'2026-02-02 07:07:24'),(5,'Taguig','6WH',800.00,600.00,350.00,'2026-02-02 07:07:24'),(6,'Pasig','AUV',600.00,400.00,350.00,'2026-02-02 07:07:24'),(7,'Pasig','FWD',1000.00,700.00,350.00,'2026-02-02 07:07:24'),(8,'Quezon','AUV',600.00,400.00,350.00,'2026-02-02 07:07:24'),(9,'Quezon','6WH',800.00,600.00,350.00,'2026-02-02 07:07:24'),(10,'Manila','AUV',600.00,400.00,350.00,'2026-02-02 07:07:24'),(11,'Manila','6WH',800.00,600.00,350.00,'2026-02-02 07:07:24'),(12,'Makati','AUV',600.00,400.00,350.00,'2026-02-02 07:07:24'),(13,'Muntinlupa','AUV',600.00,400.00,350.00,'2026-02-02 07:07:24'),(14,'Muntinlupa','FWD',1000.00,700.00,350.00,'2026-02-02 07:07:24'),(15,'Mandaluyong','AUV',600.00,400.00,350.00,'2026-02-02 07:07:24'),(16,'Valenzuela','AUV',600.00,400.00,350.00,'2026-02-02 07:07:24'),(17,'Valenzuela','6WH',800.00,600.00,350.00,'2026-02-02 07:07:24'),(18,'Malabon','AUV',600.00,400.00,350.00,'2026-02-02 07:07:24'),(19,'Malabon','H100',620.00,420.00,350.00,'2026-02-02 07:07:24'),(20,'Paranaque','AUV',600.00,400.00,350.00,'2026-02-02 07:07:24'),(21,'Paranaque','6WH',800.00,600.00,350.00,'2026-02-02 07:07:24'),(22,'Paranaque','FWD',1000.00,800.00,350.00,'2026-02-02 07:07:24'),(23,'Las Pinas','AUV',600.00,400.00,350.00,'2026-02-02 07:07:24'),(24,'Caloocan','AUV',600.00,400.00,350.00,'2026-02-02 07:07:24'),(25,'Marikina','AUV',600.00,400.00,350.00,'2026-02-02 07:07:24'),(26,'Rizal','AUV',600.00,400.00,350.00,'2026-02-02 07:07:24'),(27,'Taytay','AUV',600.00,400.00,350.00,'2026-02-02 07:07:24'),(28,'Montalban','AUV',600.00,400.00,350.00,'2026-02-02 07:07:24'),(29,'Cavite','AUV',700.00,500.00,350.00,'2026-02-02 07:07:24'),(30,'Cavite','H100',700.00,500.00,350.00,'2026-02-02 07:07:24'),(31,'Cavite','6WH',800.00,600.00,350.00,'2026-02-02 07:07:24'),(32,'Cavite','FWD',1000.00,700.00,350.00,'2026-02-02 07:07:24'),(33,'Imus','AUV',700.00,500.00,350.00,'2026-02-02 07:07:24'),(34,'Dasmarinas','AUV',700.00,500.00,350.00,'2026-02-02 07:07:24'),(35,'Silang','AUV',700.00,500.00,350.00,'2026-02-02 07:07:24'),(36,'Silang','FWD',1000.00,700.00,350.00,'2026-02-02 07:07:24'),(37,'Laguna','AUV',700.00,500.00,350.00,'2026-02-02 07:07:24'),(38,'Laguna','H100',620.00,420.00,350.00,'2026-02-02 07:07:24'),(39,'Laguna','FWD',1000.00,700.00,350.00,'2026-02-02 07:07:24'),(40,'Sta Rosa','AUV',700.00,500.00,350.00,'2026-02-02 07:07:24'),(41,'Binan','AUV',700.00,500.00,350.00,'2026-02-02 07:07:24'),(42,'San Pedro','AUV',700.00,500.00,350.00,'2026-02-02 07:07:24'),(43,'Cabuyao','AUV',700.00,500.00,350.00,'2026-02-02 07:07:24'),(44,'Calamba','AUV',700.00,500.00,350.00,'2026-02-02 07:07:24'),(45,'Batangas','AUV',800.00,500.00,350.00,'2026-02-02 07:07:24'),(46,'Batangas','H100',800.00,500.00,350.00,'2026-02-02 07:07:24'),(47,'Batangas','6WH',1200.00,800.00,350.00,'2026-02-02 07:07:24'),(48,'Sto Tomas','AUV',700.00,500.00,350.00,'2026-02-02 07:07:24'),(49,'Sto Tomas','6WH',800.00,600.00,350.00,'2026-02-02 07:07:24'),(50,'Lipa','AUV',800.00,500.00,350.00,'2026-02-02 07:07:24'),(51,'Tanauan','AUV',700.00,500.00,350.00,'2026-02-02 07:07:24'),(52,'Bulacan','AUV',700.00,500.00,350.00,'2026-02-02 07:07:24'),(53,'Bulacan','H100',720.00,470.00,350.00,'2026-02-02 07:07:24'),(54,'Pampanga','AUV',900.00,600.00,350.00,'2026-02-02 07:07:24'),(55,'Pampanga','6WH',1200.00,800.00,350.00,'2026-02-02 07:07:24'),(56,'Tarlac','AUV',1200.00,800.00,350.00,'2026-02-02 07:07:24'),(57,'Tarlac','FWD',1800.00,1000.00,500.00,'2026-02-02 07:07:24'),(58,'Zambales','AUV',1500.00,1000.00,400.00,'2026-02-02 07:07:24'),(59,'Subic','AUV',1500.00,1000.00,400.00,'2026-02-02 07:07:24'),(60,'Cabanatuan','AUV',1300.00,900.00,400.00,'2026-02-02 07:07:24'),(61,'Pangasinan','AUV',1800.00,1200.00,500.00,'2026-02-02 07:07:24'),(62,'Pangasinan','FWD',2000.00,1200.00,500.00,'2026-02-02 07:07:24'),(63,'Ilocos','6WH',2500.00,1500.00,600.00,'2026-02-02 07:07:24'),(64,'Ilocos Sur','6WH',2000.00,1200.00,600.00,'2026-02-02 07:07:24'),(65,'Baguio','AUV',1800.00,1200.00,500.00,'2026-02-02 07:07:24'),(66,'La Union','AUV',1800.00,1200.00,500.00,'2026-02-02 07:07:24'),(67,'Isabela','AUV',3000.00,1800.00,600.00,'2026-02-02 07:07:24'),(68,'Tuguegarao','AUV',3200.00,2000.00,600.00,'2026-02-02 07:07:24'),(69,'Bicol','6WH',3500.00,2000.00,700.00,'2026-02-02 07:07:24'),(70,'Cam Sur','AUV',3000.00,1800.00,600.00,'2026-02-02 07:07:24'),(71,'Pili','AUV',3000.00,1800.00,600.00,'2026-02-02 07:07:24'),(72,'Legazpi','AUV',3500.00,2000.00,700.00,'2026-02-02 07:07:24'),(73,'Naga','AUV',3000.00,1800.00,600.00,'2026-02-02 07:07:24'),(74,'Lucena','AUV',1000.00,700.00,350.00,'2026-02-02 07:07:24'),(75,'Candelaria','AUV',1000.00,700.00,350.00,'2026-02-02 07:07:24');
/*!40000 ALTER TABLE `PayrollRates` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ShipmentCrew`
--

DROP TABLE IF EXISTS `ShipmentCrew`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ShipmentCrew` (
  `shipmentCrewID` int NOT NULL AUTO_INCREMENT,
  `shipmentID` int NOT NULL,
  `userID` int NOT NULL,
  `role` varchar(50) NOT NULL,
  PRIMARY KEY (`shipmentCrewID`),
  KEY `shipmentID` (`shipmentID`),
  KEY `userID` (`userID`),
  KEY `idx_crew_role` (`role`),
  CONSTRAINT `ShipmentCrew_ibfk_1` FOREIGN KEY (`shipmentID`) REFERENCES `Shipments` (`shipmentID`) ON DELETE CASCADE,
  CONSTRAINT `ShipmentCrew_ibfk_2` FOREIGN KEY (`userID`) REFERENCES `Users` (`userID`)
) ENGINE=InnoDB AUTO_INCREMENT=55 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ShipmentCrew`
--

LOCK TABLES `ShipmentCrew` WRITE;
/*!40000 ALTER TABLE `ShipmentCrew` DISABLE KEYS */;
INSERT INTO `ShipmentCrew` VALUES (1,1001,3,'Driver'),(2,1001,4,'Helper'),(3,1002,5,'Driver'),(4,1002,6,'Helper'),(5,6454664,3,'Driver'),(6,6454664,6,'Helper'),(7,654646,3,'Driver'),(8,654646,5,'Helper'),(9,646456,3,'Driver'),(10,646456,5,'Helper'),(11,6565466,3,'Driver'),(12,6565466,5,'Helper'),(13,543663,3,'Driver'),(14,543663,5,'Helper'),(15,6666666,3,'Driver'),(16,6666666,5,'Helper'),(17,564566,3,'Driver'),(18,564566,6,'Helper'),(19,999999,3,'Driver'),(20,999999,4,'Helper'),(21,8787878,3,'Driver'),(22,8787878,5,'Helper'),(23,67676767,3,'Driver'),(24,67676767,6,'Helper'),(25,69696969,3,'Driver'),(26,69696969,6,'Helper'),(27,1234567,3,'Driver'),(28,1234567,4,'Helper'),(29,2344234,3,'Driver'),(30,2344234,6,'Helper'),(31,76767676,3,'Driver'),(32,76767676,6,'Helper'),(33,5445,3,'Driver'),(34,5445,6,'Helper'),(35,434444,3,'Driver'),(36,434444,4,'Helper'),(37,656566,3,'Driver'),(38,656566,6,'Helper'),(39,45888888,3,'Driver'),(40,45888888,6,'Helper'),(41,7777,3,'Driver'),(42,7777,6,'Helper'),(43,556666,3,'Driver'),(44,556666,6,'Helper'),(45,566334,3,'Driver'),(46,566334,6,'Helper'),(47,5663345,3,'Driver'),(48,5663345,4,'Helper'),(49,645654,3,'Driver'),(50,645654,4,'Helper'),(51,54353543,3,'Driver'),(52,54353543,5,'Helper'),(53,432434,3,'Driver'),(54,432434,5,'Helper');
/*!40000 ALTER TABLE `ShipmentCrew` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ShipmentPayroll`
--

DROP TABLE IF EXISTS `ShipmentPayroll`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ShipmentPayroll` (
  `payrollID` int NOT NULL AUTO_INCREMENT,
  `shipmentID` int NOT NULL,
  `crewID` int NOT NULL,
  `baseFee` decimal(10,2) DEFAULT NULL,
  `allowance` decimal(10,2) DEFAULT NULL,
  `additionalPay` decimal(10,2) DEFAULT '0.00',
  `deductions` decimal(10,2) DEFAULT '0.00',
  `totalPayout` decimal(10,2) GENERATED ALWAYS AS (((`baseFee` + `additionalPay`) - `deductions`)) STORED,
  `periodID` int DEFAULT NULL,
  PRIMARY KEY (`payrollID`),
  UNIQUE KEY `unique_shipment_crew` (`shipmentID`,`crewID`),
  KEY `crewID` (`crewID`),
  KEY `periodID` (`periodID`),
  CONSTRAINT `ShipmentPayroll_ibfk_1` FOREIGN KEY (`shipmentID`) REFERENCES `Shipments` (`shipmentID`) ON DELETE CASCADE,
  CONSTRAINT `ShipmentPayroll_ibfk_2` FOREIGN KEY (`crewID`) REFERENCES `Users` (`userID`),
  CONSTRAINT `ShipmentPayroll_ibfk_3` FOREIGN KEY (`periodID`) REFERENCES `PayrollPeriods` (`periodID`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=51 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ShipmentPayroll`
--

LOCK TABLES `ShipmentPayroll` WRITE;
/*!40000 ALTER TABLE `ShipmentPayroll` DISABLE KEYS */;
INSERT INTO `ShipmentPayroll` (`payrollID`, `shipmentID`, `crewID`, `baseFee`, `allowance`, `additionalPay`, `deductions`, `periodID`) VALUES (1,1001,3,500.00,150.00,0.00,0.00,1),(2,1001,4,350.00,150.00,0.00,0.00,1),(3,6454664,3,1800.00,200.00,0.00,0.00,3),(4,6454664,6,900.00,200.00,0.00,0.00,3),(5,654646,3,800.00,100.00,0.00,0.00,3),(6,654646,5,500.00,100.00,0.00,0.00,3),(7,646456,3,800.00,100.00,0.00,0.00,3),(8,646456,5,500.00,100.00,0.00,0.00,3),(9,6565466,3,800.00,100.00,0.00,0.00,3),(10,6565466,5,500.00,100.00,0.00,0.00,3),(11,543663,3,1500.00,175.00,0.00,0.00,3),(12,543663,5,800.00,175.00,0.00,0.00,3),(13,6666666,3,500.00,75.00,0.00,0.00,3),(14,6666666,5,350.00,75.00,0.00,0.00,3),(15,564566,3,1800.00,200.00,0.00,0.00,3),(16,564566,6,900.00,200.00,0.00,0.00,3),(17,999999,3,1500.00,175.00,0.00,0.00,3),(18,999999,4,800.00,175.00,0.00,0.00,3),(19,8787878,5,900.00,200.00,0.00,0.00,3),(20,8787878,3,1800.00,200.00,0.00,0.00,3),(21,67676767,3,1500.00,175.00,0.00,0.00,3),(22,67676767,6,800.00,175.00,0.00,0.00,3),(23,69696969,3,1800.00,200.00,0.00,0.00,3),(24,69696969,6,900.00,200.00,0.00,0.00,3),(25,1234567,3,1800.00,200.00,0.00,0.00,3),(26,1234567,4,900.00,200.00,0.00,0.00,3),(27,2344234,3,1800.00,200.00,0.00,0.00,3),(28,2344234,6,900.00,200.00,0.00,0.00,3),(29,5445,6,900.00,200.00,0.00,0.00,3),(30,5445,3,1800.00,200.00,0.00,0.00,3),(31,76767676,3,1800.00,200.00,0.00,0.00,3),(32,76767676,6,900.00,200.00,0.00,0.00,3),(39,434444,3,1800.00,200.00,0.00,0.00,3),(40,434444,4,900.00,200.00,0.00,0.00,3),(41,656566,6,350.00,75.00,0.00,0.00,3),(42,656566,3,500.00,75.00,0.00,0.00,3),(43,45888888,3,800.00,100.00,0.00,0.00,3),(44,45888888,6,500.00,100.00,0.00,0.00,3),(45,556666,6,1000.00,175.00,0.00,0.00,3),(46,556666,3,10000.00,175.00,0.00,0.00,3),(47,566334,6,1000.00,175.00,0.00,0.00,3),(48,566334,3,10000.00,175.00,0.00,0.00,3),(49,5663345,3,10000.00,175.00,0.00,0.00,3),(50,5663345,4,1000.00,175.00,0.00,0.00,3);
/*!40000 ALTER TABLE `ShipmentPayroll` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ShipmentStatusLog`
--

DROP TABLE IF EXISTS `ShipmentStatusLog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ShipmentStatusLog` (
  `statusLogID` int NOT NULL AUTO_INCREMENT,
  `shipmentID` int NOT NULL,
  `userID` int NOT NULL,
  `phaseName` varchar(50) DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  `timestamp` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`statusLogID`),
  KEY `shipmentID` (`shipmentID`),
  KEY `userID` (`userID`),
  CONSTRAINT `ShipmentStatusLog_ibfk_1` FOREIGN KEY (`shipmentID`) REFERENCES `Shipments` (`shipmentID`),
  CONSTRAINT `ShipmentStatusLog_ibfk_2` FOREIGN KEY (`userID`) REFERENCES `Users` (`userID`)
) ENGINE=InnoDB AUTO_INCREMENT=179 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ShipmentStatusLog`
--

LOCK TABLES `ShipmentStatusLog` WRITE;
/*!40000 ALTER TABLE `ShipmentStatusLog` DISABLE KEYS */;
INSERT INTO `ShipmentStatusLog` VALUES (1,6454664,1,'Creation','Created','2026-02-02 00:47:24'),(2,6454664,3,'Arrival','Arrival','2026-02-02 00:47:36'),(3,6454664,3,'Handover Invoice','Handover Invoice','2026-02-02 00:47:39'),(4,6454664,3,'Start Unload','Start Unload','2026-02-02 00:47:41'),(5,6454664,3,'Finish Unload','Finish Unload','2026-02-02 00:47:45'),(6,6454664,3,'Invoice Receive','Invoice Receive','2026-02-02 00:47:46'),(7,6454664,3,'Departure','Departure','2026-02-02 00:47:47'),(8,6454664,3,'Completed','Completed','2026-02-02 00:47:47'),(9,654646,1,'Creation','Created','2026-02-02 00:54:04'),(10,654646,3,'Arrival','Arrival','2026-02-02 00:54:11'),(11,654646,3,'Handover Invoice','Handover Invoice','2026-02-02 00:54:13'),(12,654646,3,'Start Unload','Start Unload','2026-02-02 00:54:14'),(13,654646,3,'Finish Unload','Finish Unload','2026-02-02 00:54:15'),(14,654646,3,'Invoice Receive','Invoice Receive','2026-02-02 00:54:16'),(15,654646,3,'Departure','Departure','2026-02-02 00:54:18'),(16,654646,3,'Completed','Completed','2026-02-02 00:54:18'),(17,646456,1,'Creation','Created','2026-02-02 01:00:24'),(18,646456,3,'Arrival','Arrival','2026-02-02 01:00:29'),(19,646456,3,'Handover Invoice','Handover Invoice','2026-02-02 01:00:30'),(20,646456,3,'Start Unload','Start Unload','2026-02-02 01:00:31'),(21,646456,3,'Finish Unload','Finish Unload','2026-02-02 01:00:32'),(22,646456,3,'Invoice Receive','Invoice Receive','2026-02-02 01:00:33'),(23,646456,3,'Departure','Departure','2026-02-02 01:00:34'),(24,646456,3,'Completed','Completed','2026-02-02 01:00:34'),(25,6565466,1,'Creation','Created','2026-02-02 01:09:28'),(26,6565466,3,'Arrival','Arrival','2026-02-02 01:09:33'),(27,6565466,3,'Handover Invoice','Handover Invoice','2026-02-02 01:09:34'),(28,6565466,3,'Start Unload','Start Unload','2026-02-02 01:09:35'),(29,6565466,3,'Finish Unload','Finish Unload','2026-02-02 01:09:36'),(30,6565466,3,'Invoice Receive','Invoice Receive','2026-02-02 01:09:37'),(31,6565466,3,'Departure','Departure','2026-02-02 01:09:38'),(32,6565466,3,'Completed','Completed','2026-02-02 01:09:38'),(33,543663,1,'Creation','Created','2026-02-02 01:14:37'),(34,543663,3,'Arrival','Arrival','2026-02-02 01:14:42'),(35,543663,3,'Handover Invoice','Handover Invoice','2026-02-02 01:14:43'),(36,543663,3,'Start Unload','Start Unload','2026-02-02 01:14:44'),(37,543663,3,'Finish Unload','Finish Unload','2026-02-02 01:14:45'),(38,543663,3,'Invoice Receive','Invoice Receive','2026-02-02 01:14:45'),(39,543663,3,'Departure','Departure','2026-02-02 01:14:47'),(40,543663,3,'Completed','Completed','2026-02-02 01:14:47'),(41,6666666,1,'Creation','Created','2026-02-02 01:21:26'),(42,6666666,3,'Arrival','Arrival','2026-02-02 01:21:29'),(43,6666666,3,'Handover Invoice','Handover Invoice','2026-02-02 01:21:30'),(44,6666666,3,'Start Unload','Start Unload','2026-02-02 01:21:31'),(45,6666666,3,'Finish Unload','Finish Unload','2026-02-02 01:21:31'),(46,6666666,3,'Invoice Receive','Invoice Receive','2026-02-02 01:21:32'),(47,6666666,3,'Departure','Departure','2026-02-02 01:21:33'),(48,6666666,3,'Completed','Completed','2026-02-02 01:21:33'),(49,564566,1,'Creation','Created','2026-02-02 01:32:43'),(50,564566,3,'Arrival','Arrival','2026-02-02 01:32:46'),(51,564566,3,'Handover Invoice','Handover Invoice','2026-02-02 01:32:47'),(52,564566,3,'Start Unload','Start Unload','2026-02-02 01:32:48'),(53,564566,3,'Finish Unload','Finish Unload','2026-02-02 01:32:49'),(54,564566,3,'Invoice Receive','Invoice Receive','2026-02-02 01:32:50'),(55,564566,3,'Departure','Departure','2026-02-02 01:32:51'),(56,564566,3,'Completed','Completed','2026-02-02 01:32:51'),(57,999999,1,'Creation','Created','2026-02-02 01:33:52'),(58,999999,3,'Arrival','Arrival','2026-02-02 01:34:12'),(59,999999,3,'Handover Invoice','Handover Invoice','2026-02-02 01:34:12'),(60,999999,3,'Start Unload','Start Unload','2026-02-02 01:34:13'),(61,999999,3,'Finish Unload','Finish Unload','2026-02-02 01:34:14'),(62,999999,3,'Invoice Receive','Invoice Receive','2026-02-02 01:34:15'),(63,999999,3,'Departure','Departure','2026-02-02 01:34:17'),(64,999999,3,'Completed','Completed','2026-02-02 01:34:17'),(65,8787878,1,'Creation','Created','2026-02-02 01:45:18'),(66,8787878,3,'Arrival','Arrival','2026-02-02 01:45:21'),(67,8787878,3,'Handover Invoice','Handover Invoice','2026-02-02 01:45:21'),(68,8787878,3,'Start Unload','Start Unload','2026-02-02 01:45:22'),(69,8787878,3,'Finish Unload','Finish Unload','2026-02-02 01:45:23'),(70,8787878,3,'Invoice Receive','Invoice Receive','2026-02-02 01:45:24'),(71,8787878,3,'Departure','Departure','2026-02-02 01:45:25'),(72,8787878,3,'Completed','Completed','2026-02-02 01:45:25'),(73,67676767,1,'Creation','Created','2026-02-02 01:52:28'),(74,67676767,3,'Arrival','Arrival','2026-02-02 01:52:32'),(75,67676767,3,'Handover Invoice','Handover Invoice','2026-02-02 01:52:33'),(76,67676767,3,'Start Unload','Start Unload','2026-02-02 01:52:34'),(77,67676767,3,'Finish Unload','Finish Unload','2026-02-02 01:52:35'),(78,67676767,3,'Invoice Receive','Invoice Receive','2026-02-02 01:52:35'),(79,67676767,3,'Departure','Departure','2026-02-02 01:52:36'),(80,67676767,3,'Completed','Completed','2026-02-02 01:52:36'),(81,69696969,1,'Creation','Created','2026-02-02 01:56:26'),(82,69696969,3,'Arrival','Arrival','2026-02-02 01:56:29'),(83,69696969,3,'Handover Invoice','Handover Invoice','2026-02-02 01:56:30'),(84,69696969,3,'Start Unload','Start Unload','2026-02-02 01:56:31'),(85,69696969,3,'Finish Unload','Finish Unload','2026-02-02 01:56:32'),(86,69696969,3,'Invoice Receive','Invoice Receive','2026-02-02 01:56:33'),(87,69696969,3,'Departure','Departure','2026-02-02 01:56:33'),(88,69696969,3,'Completed','Completed','2026-02-02 01:56:33'),(89,1234567,1,'Creation','Created','2026-02-02 02:03:14'),(90,1234567,3,'Arrival','Arrival','2026-02-02 02:03:20'),(91,1234567,3,'Handover Invoice','Handover Invoice','2026-02-02 02:03:23'),(92,1234567,3,'Start Unload','Start Unload','2026-02-02 02:03:25'),(93,1234567,3,'Finish Unload','Finish Unload','2026-02-02 02:03:26'),(94,1234567,3,'Invoice Receive','Invoice Receive','2026-02-02 02:03:27'),(95,1234567,3,'Departure','Departure','2026-02-02 02:03:33'),(96,1234567,3,'Completed','Completed','2026-02-02 02:03:33'),(97,2344234,1,'Creation','Created','2026-02-02 02:04:34'),(98,2344234,3,'Arrival','Arrival','2026-02-02 02:04:42'),(99,2344234,3,'Handover Invoice','Handover Invoice','2026-02-02 02:04:43'),(100,2344234,3,'Start Unload','Start Unload','2026-02-02 02:04:44'),(101,2344234,3,'Finish Unload','Finish Unload','2026-02-02 02:04:45'),(102,2344234,3,'Invoice Receive','Invoice Receive','2026-02-02 02:04:46'),(103,2344234,3,'Departure','Departure','2026-02-02 02:04:48'),(104,2344234,3,'Completed','Completed','2026-02-02 02:04:48'),(105,76767676,1,'Creation','Created','2026-02-02 02:11:33'),(106,76767676,3,'Arrival','Arrival','2026-02-02 02:11:40'),(107,76767676,3,'Handover Invoice','Handover Invoice','2026-02-02 02:11:44'),(108,76767676,3,'Start Unload','Start Unload','2026-02-02 02:11:51'),(109,76767676,3,'Finish Unload','Finish Unload','2026-02-02 02:12:07'),(110,76767676,3,'Invoice Receive','Invoice Receive','2026-02-02 02:12:09'),(111,76767676,3,'Departure','Departure','2026-02-02 02:12:12'),(112,76767676,3,'Completed','Completed','2026-02-02 02:12:12'),(113,5445,1,'Creation','Created','2026-02-02 02:19:23'),(114,5445,3,'Arrival','Arrival','2026-02-02 02:19:34'),(115,5445,3,'Handover Invoice','Handover Invoice','2026-02-02 02:19:39'),(116,5445,3,'Start Unload','Start Unload','2026-02-02 02:19:42'),(117,5445,3,'Finish Unload','Finish Unload','2026-02-02 02:19:43'),(118,5445,3,'Invoice Receive','Invoice Receive','2026-02-02 02:19:49'),(119,5445,3,'Departure','Departure','2026-02-02 02:19:58'),(120,5445,3,'Completed','Completed','2026-02-02 02:19:58'),(121,434444,1,'Creation','Created','2026-02-02 02:29:01'),(122,434444,3,'Arrival','Arrival','2026-02-02 10:29:09'),(123,434444,3,'Handover Invoice','Handover Invoice','2026-02-02 10:29:12'),(124,434444,3,'Start Unload','Start Unload','2026-02-02 10:29:15'),(125,434444,3,'Finish Unload','Finish Unload','2026-02-02 10:29:19'),(126,434444,3,'Invoice Receive','Invoice Receive','2026-02-02 10:29:23'),(127,434444,3,'Departure','Departure','2026-02-02 10:29:24'),(128,434444,3,'Completed','Completed','2026-02-02 10:29:24'),(129,656566,1,'Creation','Created','2026-02-02 02:31:58'),(130,656566,3,'Arrival','Arrival','2026-02-02 10:32:04'),(131,656566,3,'Handover Invoice','Handover Invoice','2026-02-02 10:32:05'),(132,656566,3,'Start Unload','Start Unload','2026-02-02 10:32:09'),(133,656566,3,'Finish Unload','Finish Unload','2026-02-02 10:32:10'),(134,656566,3,'Invoice Receive','Invoice Receive','2026-02-02 10:32:12'),(135,656566,3,'Departure','Departure','2026-02-02 10:32:13'),(136,656566,3,'Completed','Completed','2026-02-02 10:32:13'),(137,45888888,1,'Creation','Created','2026-02-02 02:34:53'),(138,45888888,3,'Arrival','Arrival','2026-02-02 10:34:59'),(139,45888888,3,'Handover Invoice','Handover Invoice','2026-02-02 10:35:01'),(140,45888888,3,'Start Unload','Start Unload','2026-02-02 10:35:02'),(141,45888888,3,'Finish Unload','Finish Unload','2026-02-02 10:35:03'),(142,45888888,3,'Invoice Receive','Invoice Receive','2026-02-02 10:35:04'),(143,45888888,3,'Departure','Departure','2026-02-02 10:35:04'),(144,45888888,3,'Completed','Completed','2026-02-02 10:35:04'),(145,7777,1,'Creation','Created','2026-02-02 02:36:58'),(146,556666,1,'Creation','Created','2026-02-02 02:37:58'),(147,7777,3,'Arrival','Arrival','2026-02-02 10:37:03'),(148,7777,3,'Handover Invoice','Handover Invoice','2026-02-02 10:37:04'),(149,7777,3,'Start Unload','Start Unload','2026-02-02 10:37:05'),(150,7777,3,'Finish Unload','Finish Unload','2026-02-02 10:37:05'),(151,7777,3,'Invoice Receive','Invoice Receive','2026-02-02 10:37:06'),(152,556666,3,'Arrival','Arrival','2026-02-02 10:38:03'),(153,556666,3,'Handover Invoice','Handover Invoice','2026-02-02 10:38:06'),(154,556666,3,'Start Unload','Start Unload','2026-02-02 10:38:07'),(155,556666,3,'Finish Unload','Finish Unload','2026-02-02 10:38:09'),(156,556666,3,'Invoice Receive','Invoice Receive','2026-02-02 10:38:12'),(157,556666,3,'Departure','Departure','2026-02-02 10:38:14'),(158,556666,3,'Completed','Completed','2026-02-02 10:38:14'),(159,566334,1,'Creation','Created','2026-02-02 02:40:52'),(160,566334,3,'Arrival','Arrival','2026-02-02 02:41:02'),(161,566334,3,'Handover Invoice','Handover Invoice','2026-02-02 02:41:11'),(162,566334,3,'Start Unload','Start Unload','2026-02-02 02:41:19'),(163,566334,3,'Finish Unload','Finish Unload','2026-02-02 10:43:13'),(164,5663345,1,'Creation','Created','2026-02-02 02:56:24'),(165,566334,3,'Invoice Receive','Invoice Receive','2026-02-02 10:53:54'),(166,566334,3,'Departure','Departure','2026-02-02 10:55:27'),(167,566334,3,'Completed','Completed','2026-02-02 10:55:27'),(168,5663345,3,'Arrival','Arrival','2026-02-02 10:56:28'),(169,5663345,3,'Handover Invoice','Handover Invoice','2026-02-02 10:56:42'),(170,5663345,3,'Start Unload','Start Unload','2026-02-02 10:56:43'),(171,5663345,3,'Finish Unload','Finish Unload','2026-02-02 10:56:49'),(172,5663345,3,'Invoice Receive','Invoice Receive','2026-02-02 10:57:03'),(173,5663345,3,'Departure','Departure','2026-02-02 10:57:04'),(174,5663345,3,'Completed','Completed','2026-02-02 10:57:04'),(175,645654,1,'Creation','Created','2026-02-02 03:31:18'),(176,54353543,1,'Creation','Created','2026-02-02 03:39:40'),(177,432434,1,'Creation','Created','2026-02-02 03:49:52'),(178,432434,3,'Arrival','Arrival','2026-02-02 12:26:42');
/*!40000 ALTER TABLE `ShipmentStatusLog` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Shipments`
--

DROP TABLE IF EXISTS `Shipments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Shipments` (
  `shipmentID` int NOT NULL,
  `userID` int DEFAULT NULL,
  `vehicleID` int NOT NULL,
  `destName` varchar(150) DEFAULT NULL,
  `destLocation` varchar(255) DEFAULT NULL,
  `loadingDate` date DEFAULT NULL,
  `deliveryDate` date DEFAULT NULL,
  `creationTimestamp` datetime DEFAULT CURRENT_TIMESTAMP,
  `currentStatus` varchar(20) DEFAULT 'Pending',
  `isArchived` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`shipmentID`),
  KEY `userID` (`userID`),
  KEY `vehicleID` (`vehicleID`),
  KEY `idx_shipment_archive_load` (`isArchived`,`loadingDate`),
  KEY `idx_shipment_creation` (`creationTimestamp`),
  KEY `idx_shipment_status` (`currentStatus`),
  CONSTRAINT `Shipments_ibfk_1` FOREIGN KEY (`userID`) REFERENCES `Users` (`userID`),
  CONSTRAINT `Shipments_ibfk_2` FOREIGN KEY (`vehicleID`) REFERENCES `Vehicles` (`vehicleID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Shipments`
--

LOCK TABLES `Shipments` WRITE;
/*!40000 ALTER TABLE `Shipments` DISABLE KEYS */;
INSERT INTO `Shipments` VALUES (1001,1,1,'SM Megamall','Metro Manila','2026-01-10','2026-01-11','2026-02-01 15:38:57','Completed',0),(1002,1,2,'Batangas Port','Provincial','2026-01-28','2026-01-30','2026-02-01 15:38:57','In Transit',0),(5445,1,4,'TEST BATCH 2','Provincial','2026-02-02','2026-02-02','2026-02-02 02:19:23','Completed',0),(7777,1,1,'FINAL HOPEFULLY','Cabuyao','2026-02-02','2026-02-02','2026-02-02 02:36:58','Invoice Receive',1),(432434,1,1,'TEST BATCH 2','Cabuyao','2026-02-02','2026-02-02','2026-02-02 03:49:52','Arrival',0),(434444,1,2,'TEST BATCH 2','Provincial','2026-02-02','2026-02-02','2026-02-02 02:29:01','Completed',0),(543663,1,1,'TEST TEST TEST','Provincial','2026-02-02','2026-02-02','2026-02-02 01:14:37','Completed',0),(556666,1,1,'TEST BATCH 2','Cabuyao','2026-02-02','2026-02-02','2026-02-02 02:37:58','Completed',0),(564566,1,4,'TRY TEST','Provincial','2026-02-02','2026-02-02','2026-02-02 01:32:43','Completed',0),(566334,1,1,'TEST BATCH 2','Cabuyao','2026-02-02','2026-02-02','2026-02-02 02:40:52','Completed',1),(645654,1,1,'TEST DATE','Cabuyao','2026-02-02','2026-02-02','2026-02-02 03:31:18','Pending',0),(646456,1,2,'TEST DOCK','Metro Manila','2026-02-02','2026-02-02','2026-02-02 01:00:24','Completed',0),(654646,1,2,'BUG TEST','Metro Manila','2026-02-02','2026-02-02','2026-02-02 00:54:04','Completed',0),(656566,1,1,'TEST BATCH 2','Metro Manila','2026-02-02','2026-02-02','2026-02-02 02:31:58','Completed',0),(999999,1,1,'TEST BATCH 2','Provincial','2026-02-02','2026-02-02','2026-02-02 01:33:52','Completed',0),(1234567,1,2,'TEST LOG','Provincial','2026-02-02','2026-02-02','2026-02-02 02:03:14','Completed',0),(2344234,1,2,'TEST BATCH 2','Provincial','2026-02-02','2026-02-02','2026-02-02 02:04:34','Completed',0),(5663345,1,1,'TEST BATCH 2','Cabuyao','2026-02-02','2026-02-02','2026-02-02 02:56:24','Completed',0),(6454664,1,2,'TEST DOCK 1','Provincial','2026-02-02','2026-02-02','2026-02-02 00:47:24','Completed',0),(6565466,1,2,'TEST BUG','Metro Manila','2026-02-02','2026-02-02','2026-02-02 01:09:28','Completed',0),(6666666,1,1,'TEST TEST TEST TEST','Metro Manila','2026-02-02','2026-02-02','2026-02-02 01:21:26','Completed',0),(8787878,1,2,'TEST GEM','Provincial','2026-02-02','2026-02-02','2026-02-02 01:45:18','Completed',0),(45888888,1,2,'TEST BATCH 2','Metro Manila','2026-02-02','2026-02-02','2026-02-02 02:34:53','Completed',0),(54353543,1,1,'TEST BLOCKED','Cabuyao','2026-02-04','2026-02-04','2026-02-02 03:39:40','Pending',0),(67676767,1,1,'TEST TRY','Provincial','2026-02-02','2026-02-02','2026-02-02 01:52:28','Completed',0),(69696969,1,2,'TEST DOCK','Provincial','2026-02-02','2026-02-02','2026-02-02 01:56:26','Completed',0),(76767676,1,2,'TEST BATCH 2','Provincial','2026-02-02','2026-02-02','2026-02-02 02:11:33','Completed',0);
/*!40000 ALTER TABLE `Shipments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `UserActivityLog`
--

DROP TABLE IF EXISTS `UserActivityLog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `UserActivityLog` (
  `logID` int NOT NULL AUTO_INCREMENT,
  `userID` int NOT NULL,
  `timestamp` datetime DEFAULT CURRENT_TIMESTAMP,
  `actionType` varchar(50) DEFAULT NULL,
  `details` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`logID`),
  KEY `userID` (`userID`),
  CONSTRAINT `UserActivityLog_ibfk_1` FOREIGN KEY (`userID`) REFERENCES `Users` (`userID`)
) ENGINE=InnoDB AUTO_INCREMENT=422 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `UserActivityLog`
--

LOCK TABLES `UserActivityLog` WRITE;
/*!40000 ALTER TABLE `UserActivityLog` DISABLE KEYS */;
INSERT INTO `UserActivityLog` VALUES (1,1,'2026-02-01 15:40:18','LOGIN','User Admin logged in'),(2,1,'2026-02-01 15:47:12','LOGIN','User Admin logged in'),(3,1,'2026-02-01 16:01:45','LOGIN','User Admin logged in'),(4,1,'2026-02-01 16:19:16','LOGIN','User Admin logged in'),(5,1,'2026-02-01 16:28:12','LOGIN','User Admin logged in'),(6,1,'2026-02-01 16:41:51','LOGIN','User Admin logged in'),(7,1,'2026-02-01 16:46:46','LOGIN','User Admin logged in'),(8,1,'2026-02-01 16:47:22','LOGIN','User Admin logged in'),(9,1,'2026-02-01 16:47:35','LOGIN','User Admin logged in'),(10,1,'2026-02-01 17:02:24','LOGOUT','System auto-logout due to inactivity'),(11,1,'2026-02-01 17:10:25','LOGIN','User Admin logged in'),(12,1,'2026-02-02 00:30:45','LOGIN','User Admin logged in'),(13,1,'2026-02-02 00:31:53','LOGIN','User Admin logged in'),(14,1,'2026-02-02 00:35:39','LOGIN','User Admin logged in'),(15,1,'2026-02-02 00:40:38','LOGIN','User Admin logged in'),(16,1,'2026-02-02 00:45:17','LOGIN','User Admin logged in'),(17,1,'2026-02-02 00:46:27','LOGIN','User Admin logged in'),(18,3,'2026-02-02 00:46:34','LOGIN','User DRV-001 logged in'),(19,1,'2026-02-02 00:46:44','LOGIN','User Admin logged in'),(20,3,'2026-02-02 00:46:51','LOGIN','User DRV-001 logged in'),(21,1,'2026-02-02 00:47:24','BATCH_CREATE','Created 1 shipments in batch.'),(22,3,'2026-02-02 00:47:36','UPDATE_SHIPMENT','Updated Shipment #6454664 to Arrival'),(23,3,'2026-02-02 00:47:39','UPDATE_SHIPMENT','Updated Shipment #6454664 to Handover Invoice'),(24,3,'2026-02-02 00:47:41','UPDATE_SHIPMENT','Updated Shipment #6454664 to Start Unload'),(25,3,'2026-02-02 00:47:45','UPDATE_SHIPMENT','Updated Shipment #6454664 to Finish Unload'),(26,3,'2026-02-02 00:47:46','UPDATE_SHIPMENT','Updated Shipment #6454664 to Invoice Receive'),(27,3,'2026-02-02 00:47:47','UPDATE_SHIPMENT','Updated Shipment #6454664 to Departure'),(28,3,'2026-02-02 00:47:47','UPDATE_SHIPMENT','Updated Shipment #6454664 to Completed'),(29,1,'2026-02-02 00:48:02','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(30,1,'2026-02-02 00:48:05','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(31,1,'2026-02-02 00:48:06','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(32,1,'2026-02-02 00:48:07','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(33,1,'2026-02-02 00:48:10','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #2'),(34,1,'2026-02-02 00:48:12','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #2'),(35,1,'2026-02-02 00:48:22','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #1'),(36,1,'2026-02-02 00:48:51','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(37,1,'2026-02-02 00:48:53','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(38,1,'2026-02-02 00:50:37','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(39,1,'2026-02-02 00:50:40','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #6'),(40,1,'2026-02-02 00:53:12','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #6'),(41,1,'2026-02-02 00:53:13','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #6'),(42,1,'2026-02-02 00:53:15','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(43,1,'2026-02-02 00:53:31','LOGIN','User Admin logged in'),(44,3,'2026-02-02 00:53:42','LOGIN','User DRV-001 logged in'),(45,1,'2026-02-02 00:54:04','BATCH_CREATE','Created 1 shipments in batch.'),(46,3,'2026-02-02 00:54:11','UPDATE_SHIPMENT','Updated Shipment #654646 to Arrival'),(47,3,'2026-02-02 00:54:13','UPDATE_SHIPMENT','Updated Shipment #654646 to Handover Invoice'),(48,3,'2026-02-02 00:54:14','UPDATE_SHIPMENT','Updated Shipment #654646 to Start Unload'),(49,3,'2026-02-02 00:54:15','UPDATE_SHIPMENT','Updated Shipment #654646 to Finish Unload'),(50,3,'2026-02-02 00:54:16','UPDATE_SHIPMENT','Updated Shipment #654646 to Invoice Receive'),(51,3,'2026-02-02 00:54:18','UPDATE_SHIPMENT','Updated Shipment #654646 to Departure'),(52,3,'2026-02-02 00:54:18','UPDATE_SHIPMENT','Updated Shipment #654646 to Completed'),(53,1,'2026-02-02 00:54:25','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #2'),(54,1,'2026-02-02 00:54:28','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(55,1,'2026-02-02 00:54:29','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(56,1,'2026-02-02 00:54:30','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(57,1,'2026-02-02 00:54:31','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(58,1,'2026-02-02 00:55:30','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(59,1,'2026-02-02 00:55:31','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(60,1,'2026-02-02 00:55:37','EXPORT_BATCH','Exported Batch Payroll for 1 periods'),(61,1,'2026-02-02 00:59:50','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #24'),(62,1,'2026-02-02 00:59:53','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(63,1,'2026-02-02 00:59:54','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(64,1,'2026-02-02 01:00:02','LOGIN','User Admin logged in'),(65,1,'2026-02-02 01:00:07','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(66,1,'2026-02-02 01:00:08','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(67,1,'2026-02-02 01:00:24','BATCH_CREATE','Created 1 shipments in batch.'),(68,3,'2026-02-02 01:00:29','UPDATE_SHIPMENT','Updated Shipment #646456 to Arrival'),(69,3,'2026-02-02 01:00:30','UPDATE_SHIPMENT','Updated Shipment #646456 to Handover Invoice'),(70,3,'2026-02-02 01:00:31','UPDATE_SHIPMENT','Updated Shipment #646456 to Start Unload'),(71,3,'2026-02-02 01:00:32','UPDATE_SHIPMENT','Updated Shipment #646456 to Finish Unload'),(72,3,'2026-02-02 01:00:33','UPDATE_SHIPMENT','Updated Shipment #646456 to Invoice Receive'),(73,3,'2026-02-02 01:00:34','UPDATE_SHIPMENT','Updated Shipment #646456 to Departure'),(74,3,'2026-02-02 01:00:34','UPDATE_SHIPMENT','Updated Shipment #646456 to Completed'),(75,1,'2026-02-02 01:00:42','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(76,1,'2026-02-02 01:00:43','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(77,1,'2026-02-02 01:00:44','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(78,1,'2026-02-02 01:04:55','LOGIN','User Admin logged in'),(79,1,'2026-02-02 01:08:05','LOGIN','User Admin logged in'),(80,1,'2026-02-02 01:08:18','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(81,1,'2026-02-02 01:08:19','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(82,1,'2026-02-02 01:08:22','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #1'),(83,1,'2026-02-02 01:08:23','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #1'),(84,1,'2026-02-02 01:08:51','LOGIN','User Admin logged in'),(85,3,'2026-02-02 01:08:59','LOGIN','User DRV-001 logged in'),(86,1,'2026-02-02 01:09:08','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(87,1,'2026-02-02 01:09:28','BATCH_CREATE','Created 1 shipments in batch.'),(88,3,'2026-02-02 01:09:33','UPDATE_SHIPMENT','Updated Shipment #6565466 to Arrival'),(89,3,'2026-02-02 01:09:34','UPDATE_SHIPMENT','Updated Shipment #6565466 to Handover Invoice'),(90,3,'2026-02-02 01:09:35','UPDATE_SHIPMENT','Updated Shipment #6565466 to Start Unload'),(91,3,'2026-02-02 01:09:36','UPDATE_SHIPMENT','Updated Shipment #6565466 to Finish Unload'),(92,3,'2026-02-02 01:09:37','UPDATE_SHIPMENT','Updated Shipment #6565466 to Invoice Receive'),(93,3,'2026-02-02 01:09:38','UPDATE_SHIPMENT','Updated Shipment #6565466 to Departure'),(94,3,'2026-02-02 01:09:38','UPDATE_SHIPMENT','Updated Shipment #6565466 to Completed'),(95,1,'2026-02-02 01:09:43','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(96,1,'2026-02-02 01:09:44','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(97,1,'2026-02-02 01:09:45','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(98,1,'2026-02-02 01:09:46','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(99,1,'2026-02-02 01:09:47','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(100,1,'2026-02-02 01:14:05','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(101,1,'2026-02-02 01:14:37','BATCH_CREATE','Created 1 shipments in batch.'),(102,3,'2026-02-02 01:14:42','UPDATE_SHIPMENT','Updated Shipment #543663 to Arrival'),(103,3,'2026-02-02 01:14:43','UPDATE_SHIPMENT','Updated Shipment #543663 to Handover Invoice'),(104,3,'2026-02-02 01:14:44','UPDATE_SHIPMENT','Updated Shipment #543663 to Start Unload'),(105,3,'2026-02-02 01:14:45','UPDATE_SHIPMENT','Updated Shipment #543663 to Finish Unload'),(106,3,'2026-02-02 01:14:45','UPDATE_SHIPMENT','Updated Shipment #543663 to Invoice Receive'),(107,3,'2026-02-02 01:14:47','UPDATE_SHIPMENT','Updated Shipment #543663 to Departure'),(108,3,'2026-02-02 01:14:47','UPDATE_SHIPMENT','Updated Shipment #543663 to Completed'),(109,1,'2026-02-02 01:14:53','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(110,1,'2026-02-02 01:14:54','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(111,1,'2026-02-02 01:14:55','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(112,1,'2026-02-02 01:14:56','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(113,1,'2026-02-02 01:14:56','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(114,1,'2026-02-02 01:19:43','LOGIN','User Admin logged in'),(115,3,'2026-02-02 01:20:12','LOGIN','User DRV-001 logged in'),(116,1,'2026-02-02 01:21:26','BATCH_CREATE','Created 1 shipments in batch.'),(117,3,'2026-02-02 01:21:29','UPDATE_SHIPMENT','Updated Shipment #6666666 to Arrival'),(118,3,'2026-02-02 01:21:30','UPDATE_SHIPMENT','Updated Shipment #6666666 to Handover Invoice'),(119,3,'2026-02-02 01:21:31','UPDATE_SHIPMENT','Updated Shipment #6666666 to Start Unload'),(120,3,'2026-02-02 01:21:31','UPDATE_SHIPMENT','Updated Shipment #6666666 to Finish Unload'),(121,3,'2026-02-02 01:21:32','UPDATE_SHIPMENT','Updated Shipment #6666666 to Invoice Receive'),(122,3,'2026-02-02 01:21:33','UPDATE_SHIPMENT','Updated Shipment #6666666 to Departure'),(123,3,'2026-02-02 01:21:33','UPDATE_SHIPMENT','Updated Shipment #6666666 to Completed'),(124,1,'2026-02-02 01:21:41','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(125,1,'2026-02-02 01:21:42','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(126,1,'2026-02-02 01:21:43','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(127,1,'2026-02-02 01:21:44','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(128,1,'2026-02-02 01:21:45','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(129,1,'2026-02-02 01:32:08','LOGIN','User Admin logged in'),(130,1,'2026-02-02 01:32:12','LOGOUT','User logged out via Desktop Portal'),(131,3,'2026-02-02 01:32:18','LOGIN','User DRV-001 logged in'),(132,1,'2026-02-02 01:32:23','LOGIN','User Admin logged in'),(133,1,'2026-02-02 01:32:43','BATCH_CREATE','Created 1 shipments in batch.'),(134,3,'2026-02-02 01:32:46','UPDATE_SHIPMENT','Updated Shipment #564566 to Arrival'),(135,3,'2026-02-02 01:32:47','UPDATE_SHIPMENT','Updated Shipment #564566 to Handover Invoice'),(136,3,'2026-02-02 01:32:48','UPDATE_SHIPMENT','Updated Shipment #564566 to Start Unload'),(137,3,'2026-02-02 01:32:49','UPDATE_SHIPMENT','Updated Shipment #564566 to Finish Unload'),(138,3,'2026-02-02 01:32:50','UPDATE_SHIPMENT','Updated Shipment #564566 to Invoice Receive'),(139,3,'2026-02-02 01:32:51','UPDATE_SHIPMENT','Updated Shipment #564566 to Departure'),(140,3,'2026-02-02 01:32:51','UPDATE_SHIPMENT','Updated Shipment #564566 to Completed'),(141,1,'2026-02-02 01:32:58','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(142,1,'2026-02-02 01:32:59','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(143,1,'2026-02-02 01:33:00','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(144,1,'2026-02-02 01:33:52','BATCH_CREATE','Created 1 shipments in batch.'),(145,3,'2026-02-02 01:34:12','UPDATE_SHIPMENT','Updated Shipment #999999 to Arrival'),(146,3,'2026-02-02 01:34:12','UPDATE_SHIPMENT','Updated Shipment #999999 to Handover Invoice'),(147,3,'2026-02-02 01:34:13','UPDATE_SHIPMENT','Updated Shipment #999999 to Start Unload'),(148,3,'2026-02-02 01:34:14','UPDATE_SHIPMENT','Updated Shipment #999999 to Finish Unload'),(149,3,'2026-02-02 01:34:15','UPDATE_SHIPMENT','Updated Shipment #999999 to Invoice Receive'),(150,3,'2026-02-02 01:34:17','UPDATE_SHIPMENT','Updated Shipment #999999 to Departure'),(151,3,'2026-02-02 01:34:17','UPDATE_SHIPMENT','Updated Shipment #999999 to Completed'),(152,1,'2026-02-02 01:34:24','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(153,1,'2026-02-02 01:34:25','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(154,1,'2026-02-02 01:44:47','LOGIN','User Admin logged in'),(155,3,'2026-02-02 01:44:55','LOGIN','User DRV-001 logged in'),(156,1,'2026-02-02 01:45:18','BATCH_CREATE','Created 1 shipments in batch.'),(157,3,'2026-02-02 01:45:21','UPDATE_SHIPMENT','Updated Shipment #8787878 to Arrival'),(158,3,'2026-02-02 01:45:21','UPDATE_SHIPMENT','Updated Shipment #8787878 to Handover Invoice'),(159,3,'2026-02-02 01:45:22','UPDATE_SHIPMENT','Updated Shipment #8787878 to Start Unload'),(160,3,'2026-02-02 01:45:23','UPDATE_SHIPMENT','Updated Shipment #8787878 to Finish Unload'),(161,3,'2026-02-02 01:45:24','UPDATE_SHIPMENT','Updated Shipment #8787878 to Invoice Receive'),(162,3,'2026-02-02 01:45:25','UPDATE_SHIPMENT','Updated Shipment #8787878 to Departure'),(163,3,'2026-02-02 01:45:25','UPDATE_SHIPMENT','Updated Shipment #8787878 to Completed'),(164,1,'2026-02-02 01:45:32','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(165,1,'2026-02-02 01:45:33','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(166,1,'2026-02-02 01:52:01','LOGIN','User Admin logged in'),(167,3,'2026-02-02 01:52:08','LOGIN','User DRV-001 logged in'),(168,1,'2026-02-02 01:52:28','BATCH_CREATE','Created 1 shipments in batch.'),(169,3,'2026-02-02 01:52:32','UPDATE_SHIPMENT','Updated Shipment #67676767 to Arrival'),(170,3,'2026-02-02 01:52:33','UPDATE_SHIPMENT','Updated Shipment #67676767 to Handover Invoice'),(171,3,'2026-02-02 01:52:34','UPDATE_SHIPMENT','Updated Shipment #67676767 to Start Unload'),(172,3,'2026-02-02 01:52:35','UPDATE_SHIPMENT','Updated Shipment #67676767 to Finish Unload'),(173,3,'2026-02-02 01:52:35','UPDATE_SHIPMENT','Updated Shipment #67676767 to Invoice Receive'),(174,3,'2026-02-02 01:52:36','UPDATE_SHIPMENT','Updated Shipment #67676767 to Departure'),(175,3,'2026-02-02 01:52:36','UPDATE_SHIPMENT','Updated Shipment #67676767 to Completed'),(176,1,'2026-02-02 01:52:44','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(177,1,'2026-02-02 01:52:45','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(178,1,'2026-02-02 01:52:46','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(179,1,'2026-02-02 01:55:57','LOGIN','User Admin logged in'),(180,3,'2026-02-02 01:56:03','LOGIN','User DRV-001 logged in'),(181,1,'2026-02-02 01:56:26','BATCH_CREATE','Created 1 shipments in batch.'),(182,3,'2026-02-02 01:56:29','UPDATE_SHIPMENT','Updated Shipment #69696969 to Arrival'),(183,3,'2026-02-02 01:56:30','UPDATE_SHIPMENT','Updated Shipment #69696969 to Handover Invoice'),(184,3,'2026-02-02 01:56:31','UPDATE_SHIPMENT','Updated Shipment #69696969 to Start Unload'),(185,3,'2026-02-02 01:56:32','UPDATE_SHIPMENT','Updated Shipment #69696969 to Finish Unload'),(186,3,'2026-02-02 01:56:33','UPDATE_SHIPMENT','Updated Shipment #69696969 to Invoice Receive'),(187,3,'2026-02-02 01:56:33','UPDATE_SHIPMENT','Updated Shipment #69696969 to Departure'),(188,3,'2026-02-02 01:56:33','UPDATE_SHIPMENT','Updated Shipment #69696969 to Completed'),(189,1,'2026-02-02 01:56:41','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(190,1,'2026-02-02 01:56:42','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(191,1,'2026-02-02 01:56:43','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(192,1,'2026-02-02 01:56:43','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(193,1,'2026-02-02 02:02:47','LOGIN','User Admin logged in'),(194,3,'2026-02-02 02:02:54','LOGIN','User DRV-001 logged in'),(195,1,'2026-02-02 02:03:14','BATCH_CREATE','Created 1 shipments in batch.'),(196,3,'2026-02-02 02:03:20','UPDATE_SHIPMENT','Updated Shipment #1234567 to Arrival'),(197,3,'2026-02-02 02:03:23','UPDATE_SHIPMENT','Updated Shipment #1234567 to Handover Invoice'),(198,3,'2026-02-02 02:03:25','UPDATE_SHIPMENT','Updated Shipment #1234567 to Start Unload'),(199,3,'2026-02-02 02:03:26','UPDATE_SHIPMENT','Updated Shipment #1234567 to Finish Unload'),(200,3,'2026-02-02 02:03:27','UPDATE_SHIPMENT','Updated Shipment #1234567 to Invoice Receive'),(201,3,'2026-02-02 02:03:33','UPDATE_SHIPMENT','Updated Shipment #1234567 to Departure'),(202,3,'2026-02-02 02:03:33','UPDATE_SHIPMENT','Updated Shipment #1234567 to Completed'),(203,1,'2026-02-02 02:04:00','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(204,1,'2026-02-02 02:04:01','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(205,1,'2026-02-02 02:04:02','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(206,1,'2026-02-02 02:04:03','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(207,1,'2026-02-02 02:04:34','BATCH_CREATE','Created 1 shipments in batch.'),(208,3,'2026-02-02 02:04:42','UPDATE_SHIPMENT','Updated Shipment #2344234 to Arrival'),(209,3,'2026-02-02 02:04:43','UPDATE_SHIPMENT','Updated Shipment #2344234 to Handover Invoice'),(210,3,'2026-02-02 02:04:44','UPDATE_SHIPMENT','Updated Shipment #2344234 to Start Unload'),(211,3,'2026-02-02 02:04:45','UPDATE_SHIPMENT','Updated Shipment #2344234 to Finish Unload'),(212,3,'2026-02-02 02:04:46','UPDATE_SHIPMENT','Updated Shipment #2344234 to Invoice Receive'),(213,3,'2026-02-02 02:04:48','UPDATE_SHIPMENT','Updated Shipment #2344234 to Departure'),(214,3,'2026-02-02 02:04:48','UPDATE_SHIPMENT','Updated Shipment #2344234 to Completed'),(215,1,'2026-02-02 02:05:01','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(216,1,'2026-02-02 02:05:02','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(217,1,'2026-02-02 02:05:02','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(218,1,'2026-02-02 02:09:31','LOGIN','User Admin logged in'),(219,3,'2026-02-02 02:09:41','LOGIN','User DRV-001 logged in'),(220,1,'2026-02-02 02:10:02','LOGIN','User Admin logged in'),(221,1,'2026-02-02 02:10:55','LOGIN','User Admin logged in'),(222,3,'2026-02-02 02:11:06','LOGIN','User DRV-001 logged in'),(223,1,'2026-02-02 02:11:33','BATCH_CREATE','Created 1 shipments in batch.'),(224,3,'2026-02-02 02:11:40','UPDATE_SHIPMENT','Updated Shipment #76767676 to Arrival'),(225,3,'2026-02-02 02:11:44','UPDATE_SHIPMENT','Updated Shipment #76767676 to Handover Invoice'),(226,3,'2026-02-02 02:11:51','UPDATE_SHIPMENT','Updated Shipment #76767676 to Start Unload'),(227,3,'2026-02-02 02:12:07','UPDATE_SHIPMENT','Updated Shipment #76767676 to Finish Unload'),(228,3,'2026-02-02 02:12:09','UPDATE_SHIPMENT','Updated Shipment #76767676 to Invoice Receive'),(229,3,'2026-02-02 02:12:12','UPDATE_SHIPMENT','Updated Shipment #76767676 to Departure'),(230,3,'2026-02-02 02:12:12','UPDATE_SHIPMENT','Updated Shipment #76767676 to Completed'),(231,1,'2026-02-02 02:18:23','LOGIN','User Admin logged in'),(232,3,'2026-02-02 02:18:31','LOGIN','User DRV-001 logged in'),(233,1,'2026-02-02 02:19:23','BATCH_CREATE','Created 1 shipments in batch.'),(234,3,'2026-02-02 02:19:34','UPDATE_SHIPMENT','Updated Shipment #5445 to Arrival'),(235,3,'2026-02-02 02:19:39','UPDATE_SHIPMENT','Updated Shipment #5445 to Handover Invoice'),(236,3,'2026-02-02 02:19:42','UPDATE_SHIPMENT','Updated Shipment #5445 to Start Unload'),(237,3,'2026-02-02 02:19:43','UPDATE_SHIPMENT','Updated Shipment #5445 to Finish Unload'),(238,3,'2026-02-02 02:19:49','UPDATE_SHIPMENT','Updated Shipment #5445 to Invoice Receive'),(239,3,'2026-02-02 02:19:58','UPDATE_SHIPMENT','Updated Shipment #5445 to Departure'),(240,3,'2026-02-02 02:19:58','UPDATE_SHIPMENT','Updated Shipment #5445 to Completed'),(241,1,'2026-02-02 02:20:51','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(242,1,'2026-02-02 02:20:52','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(243,1,'2026-02-02 02:22:18','LOGIN','User Admin logged in'),(244,3,'2026-02-02 02:28:37','LOGIN','User DRV-001 logged in'),(245,1,'2026-02-02 02:28:38','LOGIN','User Admin logged in'),(246,1,'2026-02-02 02:29:01','BATCH_CREATE','Created 1 shipments in batch.'),(247,3,'2026-02-02 02:29:09','UPDATE_SHIPMENT','Updated Shipment #434444 to Arrival'),(248,3,'2026-02-02 02:29:12','UPDATE_SHIPMENT','Updated Shipment #434444 to Handover Invoice'),(249,3,'2026-02-02 02:29:15','UPDATE_SHIPMENT','Updated Shipment #434444 to Start Unload'),(250,3,'2026-02-02 02:29:19','UPDATE_SHIPMENT','Updated Shipment #434444 to Finish Unload'),(251,3,'2026-02-02 02:29:22','UPDATE_SHIPMENT','Updated Shipment #434444 to Invoice Receive'),(252,3,'2026-02-02 02:29:23','UPDATE_SHIPMENT','Updated Shipment #434444 to Departure'),(253,3,'2026-02-02 02:29:23','UPDATE_SHIPMENT','Updated Shipment #434444 to Completed'),(254,1,'2026-02-02 02:29:45','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(255,1,'2026-02-02 02:29:46','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(256,1,'2026-02-02 02:29:47','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(257,1,'2026-02-02 02:31:58','BATCH_CREATE','Created 1 shipments in batch.'),(258,3,'2026-02-02 02:32:03','UPDATE_SHIPMENT','Updated Shipment #656566 to Arrival'),(259,3,'2026-02-02 02:32:05','UPDATE_SHIPMENT','Updated Shipment #656566 to Handover Invoice'),(260,3,'2026-02-02 02:32:08','UPDATE_SHIPMENT','Updated Shipment #656566 to Start Unload'),(261,3,'2026-02-02 02:32:09','UPDATE_SHIPMENT','Updated Shipment #656566 to Finish Unload'),(262,3,'2026-02-02 02:32:12','UPDATE_SHIPMENT','Updated Shipment #656566 to Invoice Receive'),(263,3,'2026-02-02 02:32:13','UPDATE_SHIPMENT','Updated Shipment #656566 to Departure'),(264,3,'2026-02-02 02:32:13','UPDATE_SHIPMENT','Updated Shipment #656566 to Completed'),(265,1,'2026-02-02 02:32:22','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(266,1,'2026-02-02 02:34:53','BATCH_CREATE','Created 1 shipments in batch.'),(267,3,'2026-02-02 02:34:59','UPDATE_SHIPMENT','Updated Shipment #45888888 to Arrival'),(268,3,'2026-02-02 02:35:00','UPDATE_SHIPMENT','Updated Shipment #45888888 to Handover Invoice'),(269,3,'2026-02-02 02:35:01','UPDATE_SHIPMENT','Updated Shipment #45888888 to Start Unload'),(270,3,'2026-02-02 02:35:02','UPDATE_SHIPMENT','Updated Shipment #45888888 to Finish Unload'),(271,3,'2026-02-02 02:35:03','UPDATE_SHIPMENT','Updated Shipment #45888888 to Invoice Receive'),(272,3,'2026-02-02 02:35:04','UPDATE_SHIPMENT','Updated Shipment #45888888 to Departure'),(273,3,'2026-02-02 02:35:04','UPDATE_SHIPMENT','Updated Shipment #45888888 to Completed'),(274,1,'2026-02-02 02:35:16','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(275,1,'2026-02-02 02:36:37','CREATE_RATE','Created new rate for Route: Cabuyao [AUV]. Driver: 10000, Helper: 1000'),(276,1,'2026-02-02 02:36:58','BATCH_CREATE','Created 1 shipments in batch.'),(277,3,'2026-02-02 02:37:35','LOGIN','User DRV-001 logged in'),(278,1,'2026-02-02 02:37:44','ARCHIVE_SHIPMENT','Archived Shipment #7777'),(279,1,'2026-02-02 02:37:58','BATCH_CREATE','Created 1 shipments in batch.'),(280,3,'2026-02-02 02:38:02','UPDATE_SHIPMENT','Updated Shipment #7777 to Arrival'),(281,3,'2026-02-02 02:38:02','UPDATE_SHIPMENT','Updated Shipment #7777 to Handover Invoice'),(282,3,'2026-02-02 02:38:02','UPDATE_SHIPMENT','Updated Shipment #7777 to Start Unload'),(283,3,'2026-02-02 02:38:02','UPDATE_SHIPMENT','Updated Shipment #7777 to Finish Unload'),(284,3,'2026-02-02 02:38:02','UPDATE_SHIPMENT','Updated Shipment #7777 to Invoice Receive'),(285,3,'2026-02-02 02:38:02','UPDATE_SHIPMENT','Updated Shipment #556666 to Arrival'),(286,3,'2026-02-02 02:38:05','UPDATE_SHIPMENT','Updated Shipment #556666 to Handover Invoice'),(287,3,'2026-02-02 02:38:07','UPDATE_SHIPMENT','Updated Shipment #556666 to Start Unload'),(288,3,'2026-02-02 02:38:08','UPDATE_SHIPMENT','Updated Shipment #556666 to Finish Unload'),(289,3,'2026-02-02 02:38:12','UPDATE_SHIPMENT','Updated Shipment #556666 to Invoice Receive'),(290,3,'2026-02-02 02:38:13','UPDATE_SHIPMENT','Updated Shipment #556666 to Departure'),(291,3,'2026-02-02 02:38:13','UPDATE_SHIPMENT','Updated Shipment #556666 to Completed'),(292,3,'2026-02-02 02:39:53','LOGIN','User DRV-001 logged in'),(293,1,'2026-02-02 02:40:38','LOGIN','User Admin logged in'),(294,1,'2026-02-02 02:40:52','BATCH_CREATE','Created 1 shipments in batch.'),(295,3,'2026-02-02 02:41:02','UPDATE_SHIPMENT','Updated Shipment #566334 to Arrival'),(296,3,'2026-02-02 02:41:11','UPDATE_SHIPMENT','Updated Shipment #566334 to Handover Invoice'),(297,3,'2026-02-02 02:41:19','UPDATE_SHIPMENT','Updated Shipment #566334 to Start Unload'),(298,3,'2026-02-02 02:43:02','LOGIN','User DRV-001 logged in'),(299,3,'2026-02-02 02:43:13','UPDATE_SHIPMENT','Updated Shipment #566334 to Finish Unload'),(300,1,'2026-02-02 02:53:38','LOGIN','User Admin logged in'),(301,3,'2026-02-02 02:53:47','LOGIN','User DRV-001 logged in'),(302,3,'2026-02-02 02:55:52','LOGIN','User DRV-001 logged in'),(303,1,'2026-02-02 02:56:04','LOGIN','User Admin logged in'),(304,1,'2026-02-02 02:56:08','ARCHIVE_SHIPMENT','Archived Shipment #566334'),(305,1,'2026-02-02 02:56:24','BATCH_CREATE','Created 1 shipments in batch.'),(306,3,'2026-02-02 02:56:28','UPDATE_SHIPMENT','Updated Shipment #566334 to Invoice Receive'),(307,3,'2026-02-02 02:56:28','UPDATE_SHIPMENT','Updated Shipment #566334 to Departure'),(308,3,'2026-02-02 02:56:28','UPDATE_SHIPMENT','Updated Shipment #566334 to Completed'),(309,3,'2026-02-02 02:56:28','UPDATE_SHIPMENT','Updated Shipment #5663345 to Arrival'),(310,3,'2026-02-02 02:56:41','UPDATE_SHIPMENT','Updated Shipment #5663345 to Handover Invoice'),(311,3,'2026-02-02 02:56:42','UPDATE_SHIPMENT','Updated Shipment #5663345 to Start Unload'),(312,3,'2026-02-02 02:56:48','UPDATE_SHIPMENT','Updated Shipment #5663345 to Finish Unload'),(313,3,'2026-02-02 02:57:02','UPDATE_SHIPMENT','Updated Shipment #5663345 to Invoice Receive'),(314,3,'2026-02-02 02:57:04','UPDATE_SHIPMENT','Updated Shipment #5663345 to Departure'),(315,3,'2026-02-02 02:57:04','UPDATE_SHIPMENT','Updated Shipment #5663345 to Completed'),(316,3,'2026-02-02 02:58:19','LOGIN','User DRV-001 logged in'),(317,3,'2026-02-02 02:58:40','LOGIN','User DRV-001 logged in'),(318,3,'2026-02-02 02:58:58','LOGIN','User DRV-001 logged in'),(319,1,'2026-02-02 03:08:07','LOGIN','User Admin logged in'),(320,1,'2026-02-02 03:08:29','ADD_PAYMENT','Recorded payment of 1 for User #3. Notes: Partial Payment'),(321,1,'2026-02-02 03:08:33','ADD_PAYMENT','Recorded payment of 54899 for User #3. Notes: Partial Payment'),(322,1,'2026-02-02 03:20:46','LOGIN','User Admin logged in'),(323,1,'2026-02-02 03:20:51','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(324,1,'2026-02-02 03:21:19','CLOSE_PERIOD','Finalized/Locked Payroll Period #1'),(325,1,'2026-02-02 03:21:51','ADD_ADJUSTMENT','Added DEDUCTION of 1000 for User #4. Reason: Advance'),(326,1,'2026-02-02 03:22:07','ADD_PAYMENT','Recorded payment of 3600 for User #4. Notes: Partial Payment'),(327,1,'2026-02-02 03:22:12','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #4'),(328,1,'2026-02-02 03:22:29','ADD_PAYMENT','Recorded payment of 9050 for User #6. Notes: Partial Payment'),(329,1,'2026-02-02 03:23:11','EXPORT_BATCH','Exported Batch Payroll for 1 periods'),(330,1,'2026-02-02 03:24:59','UPLOAD_KPI_REPORT','Uploaded KPI Report - DECEMBER 2028 [ID: 4]'),(331,3,'2026-02-02 03:27:07','LOGIN','User DRV-001 logged in'),(332,3,'2026-02-02 03:30:43','LOGIN','User DRV-001 logged in'),(333,3,'2026-02-02 03:30:59','LOGIN','User DRV-001 logged in'),(334,1,'2026-02-02 03:31:18','BATCH_CREATE','Created 1 shipments in batch.'),(335,3,'2026-02-02 03:33:31','LOGIN','User DRV-001 logged in'),(336,3,'2026-02-02 03:34:49','LOGIN','User DRV-001 logged in'),(337,1,'2026-02-02 03:39:40','BATCH_CREATE','Created 1 shipments in batch.'),(338,1,'2026-02-02 03:44:21','LOGIN','User Admin logged in'),(339,1,'2026-02-02 03:44:25','LOGOUT','User logged out via Desktop Portal'),(340,1,'2026-02-02 03:44:29','LOGIN','User Admin logged in'),(341,3,'2026-02-02 03:45:03','LOGIN','User DRV-001 logged in'),(342,1,'2026-02-02 03:49:52','BATCH_CREATE','Created 1 shipments in batch.'),(343,3,'2026-02-02 03:52:55','LOGIN','User DRV-001 logged in'),(344,1,'2026-02-02 03:56:11','LOGIN','User Admin logged in'),(345,1,'2026-02-02 03:58:06','LOGIN','User Admin logged in'),(346,1,'2026-02-02 03:58:47','LOGIN','User Admin logged in'),(347,1,'2026-02-02 04:03:38','LOGIN','User Admin logged in'),(348,1,'2026-02-02 04:05:00','GENERATE_PAYROLL','Harvested/Generated payroll calculation for Period #3'),(349,1,'2026-02-02 04:08:59','LOGIN','User Admin logged in'),(350,1,'2026-02-02 04:09:53','LOGIN','User Admin logged in'),(351,1,'2026-02-02 04:11:53','LOGIN','User Admin logged in'),(352,1,'2026-02-02 04:12:04','LOGIN','User Admin logged in'),(353,1,'2026-02-02 04:12:18','LOGIN','User Admin logged in'),(354,1,'2026-02-02 04:16:27','LOGIN','User Admin logged in'),(355,1,'2026-02-02 04:16:52','LOGIN','User Admin logged in'),(356,1,'2026-02-02 04:19:00','LOGIN','User Admin logged in'),(357,1,'2026-02-02 04:19:16','LOGIN','User Admin logged in'),(358,1,'2026-02-02 04:19:33','LOGIN','User Admin logged in'),(359,1,'2026-02-02 04:20:19','LOGIN','User Admin logged in'),(360,1,'2026-02-02 04:20:34','LOGIN','User Admin logged in'),(361,1,'2026-02-02 04:23:30','LOGIN','User Admin logged in'),(362,1,'2026-02-02 04:23:46','LOGIN','User Admin logged in'),(363,1,'2026-02-02 04:26:14','LOGIN','User Admin logged in'),(364,3,'2026-02-02 04:26:38','LOGIN','User DRV-001 logged in'),(365,3,'2026-02-02 04:26:42','UPDATE_SHIPMENT','Updated Shipment #432434 to Arrival'),(366,1,'2026-02-02 04:28:06','LOGIN','User Admin logged in'),(367,1,'2026-02-02 04:28:23','LOGIN','User Admin logged in'),(368,1,'2026-02-02 04:29:49','LOGIN','User Admin logged in'),(369,1,'2026-02-02 04:30:40','LOGIN','User Admin logged in'),(370,3,'2026-02-02 04:33:50','LOGOUT','User logged out via Mobile App'),(371,1,'2026-02-02 04:33:54','LOGIN','User Admin logged in'),(372,1,'2026-02-02 04:34:42','LOGIN','User Admin logged in'),(373,1,'2026-02-02 04:34:56','LOGIN','User Admin logged in'),(374,1,'2026-02-02 04:35:13','LOGIN','User Admin logged in'),(375,1,'2026-02-02 04:37:30','LOGIN','User Admin logged in'),(376,1,'2026-02-02 04:37:39','LOGIN','User Admin logged in'),(377,1,'2026-02-02 04:37:55','LOGIN','User Admin logged in'),(378,1,'2026-02-02 04:43:13','LOGIN','User Admin logged in'),(379,1,'2026-02-02 04:43:28','LOGIN','User Admin logged in'),(380,1,'2026-02-02 04:46:42','LOGOUT','User logged out via Desktop Portal'),(381,1,'2026-02-02 04:46:44','LOGOUT','User logged out via Desktop Portal'),(382,1,'2026-02-02 04:46:49','LOGIN','User Admin logged in'),(383,1,'2026-02-02 04:46:57','LOGIN','User Admin logged in'),(384,1,'2026-02-02 04:52:33','LOGOUT','User logged out via Desktop Portal'),(385,1,'2026-02-02 04:52:34','LOGOUT','User logged out via Desktop Portal'),(386,1,'2026-02-02 04:52:41','LOGIN','User Admin logged in'),(387,1,'2026-02-02 04:52:50','LOGIN','User Admin logged in'),(388,1,'2026-02-02 05:28:28','LOGOUT','User logged out via Desktop Portal'),(389,1,'2026-02-02 05:28:38','LOGIN','User Admin logged in'),(390,1,'2026-02-02 05:28:50','LOGIN','User Admin logged in'),(391,1,'2026-02-02 05:28:59','LOGIN','User Admin logged in'),(392,1,'2026-02-02 05:29:16','LOGIN','User Admin logged in'),(393,1,'2026-02-02 05:31:57','LOGIN','User Admin logged in'),(394,1,'2026-02-02 05:32:05','LOGIN','User Admin logged in'),(395,1,'2026-02-02 05:32:22','LOGIN','User Admin logged in'),(396,1,'2026-02-02 05:34:27','LOGIN','User Admin logged in'),(397,1,'2026-02-02 05:34:41','LOGIN','User Admin logged in'),(398,1,'2026-02-02 05:34:51','LOGIN','User Admin logged in'),(399,1,'2026-02-02 05:35:01','LOGIN','User Admin logged in'),(400,1,'2026-02-02 05:35:17','LOGOUT','User logged out via Desktop Portal'),(401,1,'2026-02-02 05:35:24','LOGIN','User Admin logged in'),(402,1,'2026-02-02 05:35:29','LOGIN','User Admin logged in'),(403,1,'2026-02-02 05:35:37','LOGIN','User Admin logged in'),(404,1,'2026-02-02 05:40:26','LOGIN','User Admin logged in'),(405,1,'2026-02-02 05:40:30','LOGIN','User Admin logged in'),(406,1,'2026-02-02 05:40:30','LOGIN','User Admin logged in'),(407,1,'2026-02-02 05:41:13','LOGIN','User Admin logged in'),(408,1,'2026-02-02 05:41:48','LOGIN','User Admin logged in'),(409,1,'2026-02-02 05:43:55','LOGIN','User Admin logged in'),(410,1,'2026-02-02 05:43:57','LOGIN','User Admin logged in'),(411,1,'2026-02-02 05:44:00','LOGOUT','User logged out via Desktop Portal'),(412,1,'2026-02-02 05:44:07','LOGIN','User Admin logged in'),(413,1,'2026-02-02 05:44:16','LOGIN','User Admin logged in'),(414,1,'2026-02-02 05:48:06','LOGIN','User Admin logged in'),(415,1,'2026-02-02 05:50:04','LOGIN','User Admin logged in'),(416,1,'2026-02-02 05:50:30','LOGIN','User Admin logged in'),(417,1,'2026-02-02 05:50:38','LOGIN','User Admin logged in'),(418,1,'2026-02-02 06:08:39','LOGIN','User Admin logged in'),(419,1,'2026-02-02 06:11:32','LOGIN','User Admin logged in'),(420,1,'2026-02-02 06:17:53','LOGIN','User Admin logged in'),(421,1,'2026-02-02 07:07:44','LOGIN','User Admin logged in');
/*!40000 ALTER TABLE `UserActivityLog` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `UserLogins`
--

DROP TABLE IF EXISTS `UserLogins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `UserLogins` (
  `loginID` int NOT NULL AUTO_INCREMENT,
  `userID` int NOT NULL,
  `employeeID` varchar(50) NOT NULL,
  `hashedPassword` varchar(255) NOT NULL,
  `activeToken` text,
  `isActive` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`loginID`),
  UNIQUE KEY `employeeID` (`employeeID`),
  KEY `userID` (`userID`),
  CONSTRAINT `UserLogins_ibfk_1` FOREIGN KEY (`userID`) REFERENCES `Users` (`userID`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `UserLogins`
--

LOCK TABLES `UserLogins` WRITE;
/*!40000 ALTER TABLE `UserLogins` DISABLE KEYS */;
INSERT INTO `UserLogins` VALUES (1,1,'Admin','$2b$10$ebU6j762YqtNM1OIIqrMKOuGvZdvE5jjIbgOK00ISD7vT1LPSk.Z6','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sZSI6IkFkbWluIiwiaWF0IjoxNzcwMDE2MDY0LCJleHAiOjE3NzAwNTkyNjR9.wJAPnhIG1eZKxpGjq8832JOHV5Xnpbyh23Pn1SzS_Bw',1),(2,2,'Ops','$2b$10$ebU6j762YqtNM1OIIqrMKOuGvZdvE5jjIbgOK00ISD7vT1LPSk.Z6',NULL,1),(3,3,'DRV-001','$2b$10$ebU6j762YqtNM1OIIqrMKOuGvZdvE5jjIbgOK00ISD7vT1LPSk.Z6','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mywicm9sZSI6IkRyaXZlciIsImlhdCI6MTc3MDAwNjM5OCwiZXhwIjoxNzcwMDQ5NTk4fQ.CqEmvc6KufbaECFOhCawfQ0Nw41Ya5IB1wWBI_VB7ew',1),(4,4,'HLP-001','$2b$10$ebU6j762YqtNM1OIIqrMKOuGvZdvE5jjIbgOK00ISD7vT1LPSk.Z6',NULL,1);
/*!40000 ALTER TABLE `UserLogins` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Users`
--

DROP TABLE IF EXISTS `Users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Users` (
  `userID` int NOT NULL AUTO_INCREMENT,
  `firstName` varchar(100) NOT NULL,
  `lastName` varchar(100) NOT NULL,
  `role` varchar(20) NOT NULL,
  `email` varchar(100) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `dob` date DEFAULT NULL,
  `dateCreated` datetime DEFAULT CURRENT_TIMESTAMP,
  `isArchived` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`userID`),
  KEY `idx_user_role_archived` (`role`,`isArchived`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Users`
--

LOCK TABLES `Users` WRITE;
/*!40000 ALTER TABLE `Users` DISABLE KEYS */;
INSERT INTO `Users` VALUES (1,'System','Admin','Admin','admin@k2mac.com',NULL,NULL,'2026-02-01 15:38:57',0),(2,'Ops','Manager','Operations','ops@k2mac.com',NULL,NULL,'2026-02-01 15:38:57',0),(3,'Juan','Driver','Driver','juan@k2mac.com',NULL,NULL,'2026-02-01 15:38:57',0),(4,'Pedro','Helper','Helper','pedro@k2mac.com',NULL,NULL,'2026-02-01 15:38:57',0),(5,'Mark','Trucker','Driver','mark@k2mac.com',NULL,NULL,'2026-02-01 15:38:57',0),(6,'Jose','Porter','Helper','jose@k2mac.com',NULL,NULL,'2026-02-01 15:38:57',0);
/*!40000 ALTER TABLE `Users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `Vehicles`
--

DROP TABLE IF EXISTS `Vehicles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Vehicles` (
  `vehicleID` int NOT NULL AUTO_INCREMENT,
  `plateNo` varchar(20) NOT NULL,
  `type` varchar(50) DEFAULT NULL,
  `status` enum('Working','Maintenance') DEFAULT 'Working',
  `dateCreated` datetime DEFAULT CURRENT_TIMESTAMP,
  `isArchived` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`vehicleID`),
  UNIQUE KEY `plateNo` (`plateNo`),
  KEY `idx_vehicle_status_archived` (`status`,`isArchived`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Vehicles`
--

LOCK TABLES `Vehicles` WRITE;
/*!40000 ALTER TABLE `Vehicles` DISABLE KEYS */;
INSERT INTO `Vehicles` VALUES (1,'ABC-1234','AUV','Working','2026-02-01 15:38:57',0),(2,'XYZ-9876','6WH','Working','2026-02-01 15:38:57',0),(3,'UV-0001','AUV','Maintenance','2026-02-01 15:38:57',0),(4,'TRK-5555','6WH','Working','2026-02-01 15:38:57',0);
/*!40000 ALTER TABLE `Vehicles` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-02-02  7:08:21
