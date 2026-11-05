-- Additive CPE schema; retains NTOP data and routes.
-- CreateTable
CREATE TABLE `CpeOpportunity` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(40) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `customer` VARCHAR(255) NOT NULL,
    `sector` VARCHAR(100) NOT NULL,
    `workType` VARCHAR(100) NOT NULL,
    `organizationUnitId` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `estimatorId` VARCHAR(191) NULL,
    `location` VARCHAR(255) NOT NULL,
    `unit` VARCHAR(40) NOT NULL,
    `quantity` DECIMAL(19, 4) NOT NULL,
    `cost` DECIMAL(19, 4) NOT NULL,
    `bid` DECIMAL(19, 4) NOT NULL,
    `margin` DECIMAL(9, 4) NOT NULL,
    `stage` VARCHAR(64) NOT NULL,
    `status` VARCHAR(64) NOT NULL,
    `dueAt` DATETIME(3) NULL,
    `technicalNotes` TEXT NULL,
    `contractNotes` TEXT NULL,
    `winner` VARCHAR(255) NULL,
    `winnerPrice` DECIMAL(19, 4) NULL,
    `lossReason` VARCHAR(255) NULL,
    `resultNotes` TEXT NULL,
    `reviewedById` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CpeOpportunity_code_key`(`code`),
    INDEX `CpeOpportunity_organizationUnitId_status_updatedAt_id_idx`(`organizationUnitId`, `status`, `updatedAt`, `id`),
    INDEX `CpeOpportunity_organizationUnitId_workType_sector_idx`(`organizationUnitId`, `workType`, `sector`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- CreateTable
CREATE TABLE `CpeBoqItem` (
    `id` VARCHAR(191) NOT NULL,
    `opportunityId` VARCHAR(191) NOT NULL,
    `category` VARCHAR(100) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `description` VARCHAR(500) NOT NULL,
    `unit` VARCHAR(40) NOT NULL,
    `quantity` DECIMAL(19, 4) NOT NULL,
    `material` DECIMAL(19, 4) NOT NULL,
    `labor` DECIMAL(19, 4) NOT NULL,
    `source` VARCHAR(255) NOT NULL,
    `catalogId` VARCHAR(191) NULL,

    INDEX `CpeBoqItem_opportunityId_category_id_idx`(`opportunityId`, `category`, `id`),
    INDEX `CpeBoqItem_catalogId_idx`(`catalogId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- CreateTable
CREATE TABLE `CpeCatalogItem` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `category` VARCHAR(100) NOT NULL,
    `unit` VARCHAR(40) NOT NULL,
    `price` DECIMAL(19, 4) NOT NULL,
    `forecastPercent` DECIMAL(9, 4) NOT NULL,
    `volatility` VARCHAR(40) NOT NULL,
    `source` VARCHAR(255) NOT NULL,
    `organizationUnitId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CpeCatalogItem_code_key`(`code`),
    INDEX `CpeCatalogItem_organizationUnitId_category_name_idx`(`organizationUnitId`, `category`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- CreateTable
CREATE TABLE `CpePriceHistory` (
    `id` VARCHAR(191) NOT NULL,
    `catalogId` VARCHAR(191) NOT NULL,
    `price` DECIMAL(19, 4) NOT NULL,
    `source` VARCHAR(255) NOT NULL,
    `actorId` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NULL,
    `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CpePriceHistory_catalogId_recordedAt_idx`(`catalogId`, `recordedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- CreateTable
CREATE TABLE `CpeVendor` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(40) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `workType` VARCHAR(100) NOT NULL,
    `organizationUnitId` VARCHAR(191) NOT NULL,
    `scores` JSON NOT NULL,
    `score` DECIMAL(9, 4) NULL,
    `grade` VARCHAR(40) NULL,
    `suspended` BOOLEAN NOT NULL DEFAULT false,
    `version` INTEGER NOT NULL DEFAULT 1,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CpeVendor_code_key`(`code`),
    INDEX `CpeVendor_organizationUnitId_workType_name_idx`(`organizationUnitId`, `workType`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- CreateTable
CREATE TABLE `CpeRfq` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(40) NOT NULL,
    `opportunityId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `category` VARCHAR(100) NOT NULL,
    `budget` DECIMAL(19, 4) NOT NULL,
    `needAt` DATETIME(3) NOT NULL,
    `documents` JSON NOT NULL,
    `status` VARCHAR(64) NOT NULL,
    `awardedQuoteId` VARCHAR(191) NULL,
    `poNumber` VARCHAR(40) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CpeRfq_code_key`(`code`),
    UNIQUE INDEX `CpeRfq_awardedQuoteId_key`(`awardedQuoteId`),
    UNIQUE INDEX `CpeRfq_poNumber_key`(`poNumber`),
    INDEX `CpeRfq_opportunityId_status_id_idx`(`opportunityId`, `status`, `id`),
    UNIQUE INDEX `CpeRfq_opportunityId_category_key`(`opportunityId`, `category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- CreateTable
CREATE TABLE `CpeVendorQuote` (
    `id` VARCHAR(191) NOT NULL,
    `rfqId` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `price` DECIMAL(19, 4) NOT NULL,
    `days` INTEGER NOT NULL,
    `paymentTerms` VARCHAR(255) NOT NULL,
    `validityDays` INTEGER NOT NULL,
    `notes` VARCHAR(1000) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CpeVendorQuote_rfqId_vendorId_key`(`rfqId`, `vendorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- CreateTable
CREATE TABLE `CpeProject` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(40) NOT NULL,
    `opportunityId` VARCHAR(191) NOT NULL,
    `contractNumber` VARCHAR(100) NOT NULL,
    `contractValue` DECIMAL(19, 4) NOT NULL,
    `budget` DECIMAL(19, 4) NOT NULL,
    `pmId` VARCHAR(191) NOT NULL,
    `startAt` DATETIME(3) NOT NULL,
    `durationMonths` INTEGER NOT NULL,
    `status` VARCHAR(64) NOT NULL,
    `risks` TEXT NULL,
    `actualCategories` JSON NULL,
    `closedAt` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `CpeProject_code_key`(`code`),
    UNIQUE INDEX `CpeProject_opportunityId_key`(`opportunityId`),
    INDEX `CpeProject_pmId_status_id_idx`(`pmId`, `status`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- CreateTable
CREATE TABLE `CpeProjectMonth` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `month` INTEGER NOT NULL,
    `plannedPercent` DECIMAL(9, 4) NOT NULL,
    `actualPercent` DECIMAL(9, 4) NULL,
    `cashIn` DECIMAL(19, 4) NOT NULL DEFAULT 0,
    `cashOut` DECIMAL(19, 4) NOT NULL DEFAULT 0,
    `forecastIn` DECIMAL(19, 4) NOT NULL DEFAULT 0,
    `forecastOut` DECIMAL(19, 4) NOT NULL DEFAULT 0,
    `poPayments` JSON NOT NULL,
    `paidPo` DECIMAL(19, 4) NOT NULL DEFAULT 0,

    UNIQUE INDEX `CpeProjectMonth_projectId_month_key`(`projectId`, `month`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- CreateTable
CREATE TABLE `CpeMasterData` (
    `id` VARCHAR(191) NOT NULL,
    `organizationUnitId` VARCHAR(191) NOT NULL,
    `configuration` JSON NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CpeMasterData_organizationUnitId_key`(`organizationUnitId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- CreateTable
CREATE TABLE `CpeImprovement` (
    `id` VARCHAR(191) NOT NULL,
    `organizationUnitId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `reason` VARCHAR(1000) NOT NULL,
    `expectedEffect` VARCHAR(1000) NOT NULL,
    `proposedConfiguration` JSON NOT NULL,
    `masterVersion` INTEGER NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `decidedById` VARCHAR(191) NULL,
    `status` VARCHAR(64) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CpeImprovement_organizationUnitId_status_id_idx`(`organizationUnitId`, `status`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- CreateTable
CREATE TABLE `CpeCommandReceipt` (
    `id` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NOT NULL,
    `requestId` VARCHAR(64) NOT NULL,
    `fingerprint` CHAR(64) NOT NULL,
    `resultId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CpeCommandReceipt_actorId_requestId_key`(`actorId`, `requestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- CreateTable
CREATE TABLE `CpeFinanceEntry` (
    `id` VARCHAR(191) NOT NULL,
    `organizationUnitId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(40) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `amount` DECIMAL(19, 4) NOT NULL,
    `dueAt` DATETIME(3) NOT NULL,
    `settledAt` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,

    INDEX `CpeFinanceEntry_organizationUnitId_kind_dueAt_idx`(`organizationUnitId`, `kind`, `dueAt`),
    INDEX `CpeFinanceEntry_organizationUnitId_createdById_idx`(`organizationUnitId`, `createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- AddForeignKey
ALTER TABLE `CpeBoqItem` ADD CONSTRAINT `CpeBoqItem_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `CpeOpportunity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE `CpeBoqItem` ADD CONSTRAINT `CpeBoqItem_catalogId_fkey` FOREIGN KEY (`catalogId`) REFERENCES `CpeCatalogItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE `CpePriceHistory` ADD CONSTRAINT `CpePriceHistory_catalogId_fkey` FOREIGN KEY (`catalogId`) REFERENCES `CpeCatalogItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE `CpeRfq` ADD CONSTRAINT `CpeRfq_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `CpeOpportunity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE `CpeVendorQuote` ADD CONSTRAINT `CpeVendorQuote_rfqId_fkey` FOREIGN KEY (`rfqId`) REFERENCES `CpeRfq`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE `CpeVendorQuote` ADD CONSTRAINT `CpeVendorQuote_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `CpeVendor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE `CpeProject` ADD CONSTRAINT `CpeProject_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `CpeOpportunity`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE `CpeProjectMonth` ADD CONSTRAINT `CpeProjectMonth_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `CpeProject`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddForeignKey
ALTER TABLE `CpeFinanceEntry` ADD CONSTRAINT `CpeFinanceEntry_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `CpeProject`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT IGNORE INTO RolePermissionGrant (id,roleCode,permissionCode,createdAt) VALUES
(UUID(), 'EXECUTIVE', 'cpe.executive.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'EXECUTIVE', 'cpe.sales.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'EXECUTIVE', 'cpe.costcheck.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'EXECUTIVE', 'cpe.bidsim.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'EXECUTIVE', 'cpe.catalog.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'EXECUTIVE', 'cpe.forecast.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'EXECUTIVE', 'cpe.vendors.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'EXECUTIVE', 'cpe.projects.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'EXECUTIVE', 'cpe.cash.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'EXECUTIVE', 'cpe.knowledge.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'EXECUTIVE', 'cpe.improvement.decide', CURRENT_TIMESTAMP(3)),
(UUID(), 'KAM', 'cpe.sales.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'KAM', 'cpe.estimate.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'KAM', 'cpe.bidsim.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'KAM', 'cpe.knowledge.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'KAM', 'cpe.sales.manage', CURRENT_TIMESTAMP(3)),
(UUID(), 'KAM', 'cpe.bidsim.manage', CURRENT_TIMESTAMP(3)),
(UUID(), 'KAM', 'cpe.improvement.propose', CURRENT_TIMESTAMP(3)),
(UUID(), 'ESTIMATOR', 'cpe.estimate.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'ESTIMATOR', 'cpe.costcheck.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'ESTIMATOR', 'cpe.bidsim.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'ESTIMATOR', 'cpe.catalog.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'ESTIMATOR', 'cpe.forecast.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'ESTIMATOR', 'cpe.procurement.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'ESTIMATOR', 'cpe.knowledge.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'ESTIMATOR', 'cpe.estimate.manage', CURRENT_TIMESTAMP(3)),
(UUID(), 'ESTIMATOR', 'cpe.costcheck.approve', CURRENT_TIMESTAMP(3)),
(UUID(), 'ESTIMATOR', 'cpe.catalog.manage', CURRENT_TIMESTAMP(3)),
(UUID(), 'ESTIMATOR', 'cpe.improvement.propose', CURRENT_TIMESTAMP(3)),
(UUID(), 'PROCUREMENT', 'cpe.catalog.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'PROCUREMENT', 'cpe.forecast.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'PROCUREMENT', 'cpe.procurement.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'PROCUREMENT', 'cpe.vendors.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'PROCUREMENT', 'cpe.knowledge.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'PROCUREMENT', 'cpe.catalog.manage', CURRENT_TIMESTAMP(3)),
(UUID(), 'PROCUREMENT', 'cpe.procurement.manage', CURRENT_TIMESTAMP(3)),
(UUID(), 'PROCUREMENT', 'cpe.procurement.award', CURRENT_TIMESTAMP(3)),
(UUID(), 'PROCUREMENT', 'cpe.vendors.manage', CURRENT_TIMESTAMP(3)),
(UUID(), 'PROCUREMENT', 'cpe.improvement.propose', CURRENT_TIMESTAMP(3)),
(UUID(), 'PROJECT_MANAGER', 'cpe.vendors.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'PROJECT_MANAGER', 'cpe.projects.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'PROJECT_MANAGER', 'cpe.cash.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'PROJECT_MANAGER', 'cpe.vendors.manage', CURRENT_TIMESTAMP(3)),
(UUID(), 'PROJECT_MANAGER', 'cpe.projects.manage', CURRENT_TIMESTAMP(3)),
(UUID(), 'PROJECT_MANAGER', 'cpe.cash.manage', CURRENT_TIMESTAMP(3)),
(UUID(), 'PRESALES', 'cpe.estimate.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'PRESALES', 'cpe.costcheck.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'PRESALES', 'cpe.bidsim.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'PRESALES', 'cpe.catalog.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'PRESALES', 'cpe.forecast.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'PRESALES', 'cpe.procurement.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'PRESALES', 'cpe.knowledge.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'PRESALES', 'cpe.estimate.manage', CURRENT_TIMESTAMP(3)),
(UUID(), 'PRESALES', 'cpe.costcheck.approve', CURRENT_TIMESTAMP(3)),
(UUID(), 'PRESALES', 'cpe.catalog.manage', CURRENT_TIMESTAMP(3)),
(UUID(), 'PRESALES', 'cpe.improvement.propose', CURRENT_TIMESTAMP(3)),
(UUID(), 'SALES_DIRECTOR', 'cpe.sales.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'SALES_DIRECTOR', 'cpe.estimate.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'SALES_DIRECTOR', 'cpe.bidsim.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'SALES_DIRECTOR', 'cpe.knowledge.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'SALES_DIRECTOR', 'cpe.sales.manage', CURRENT_TIMESTAMP(3)),
(UUID(), 'SALES_DIRECTOR', 'cpe.bidsim.manage', CURRENT_TIMESTAMP(3)),
(UUID(), 'SALES_DIRECTOR', 'cpe.improvement.propose', CURRENT_TIMESTAMP(3)),
(UUID(), 'TEAM_MANAGER', 'cpe.sales.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'TEAM_MANAGER', 'cpe.estimate.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'TEAM_MANAGER', 'cpe.bidsim.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'TEAM_MANAGER', 'cpe.knowledge.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'TEAM_MANAGER', 'cpe.sales.manage', CURRENT_TIMESTAMP(3)),
(UUID(), 'TEAM_MANAGER', 'cpe.bidsim.manage', CURRENT_TIMESTAMP(3)),
(UUID(), 'TEAM_MANAGER', 'cpe.improvement.propose', CURRENT_TIMESTAMP(3)),
(UUID(), 'ADMIN', 'cpe.executive.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'ADMIN', 'cpe.sales.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'ADMIN', 'cpe.estimate.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'ADMIN', 'cpe.costcheck.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'ADMIN', 'cpe.bidsim.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'ADMIN', 'cpe.catalog.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'ADMIN', 'cpe.forecast.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'ADMIN', 'cpe.procurement.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'ADMIN', 'cpe.vendors.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'ADMIN', 'cpe.projects.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'ADMIN', 'cpe.cash.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'ADMIN', 'cpe.knowledge.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'ADMIN', 'cpe.sales.manage', CURRENT_TIMESTAMP(3)),
(UUID(), 'ADMIN', 'cpe.estimate.manage', CURRENT_TIMESTAMP(3)),
(UUID(), 'ADMIN', 'cpe.costcheck.approve', CURRENT_TIMESTAMP(3)),
(UUID(), 'ADMIN', 'cpe.bidsim.manage', CURRENT_TIMESTAMP(3)),
(UUID(), 'ADMIN', 'cpe.catalog.manage', CURRENT_TIMESTAMP(3)),
(UUID(), 'ADMIN', 'cpe.procurement.manage', CURRENT_TIMESTAMP(3)),
(UUID(), 'ADMIN', 'cpe.procurement.award', CURRENT_TIMESTAMP(3)),
(UUID(), 'ADMIN', 'cpe.vendors.manage', CURRENT_TIMESTAMP(3)),
(UUID(), 'ADMIN', 'cpe.projects.manage', CURRENT_TIMESTAMP(3)),
(UUID(), 'ADMIN', 'cpe.cash.manage', CURRENT_TIMESTAMP(3)),
(UUID(), 'ADMIN', 'cpe.master.manage', CURRENT_TIMESTAMP(3)),
(UUID(), 'ADMIN', 'cpe.improvement.propose', CURRENT_TIMESTAMP(3)),
(UUID(), 'ADMIN', 'cpe.improvement.decide', CURRENT_TIMESTAMP(3)),
(UUID(), 'ADMIN', 'cpe.sales.manage-all', CURRENT_TIMESTAMP(3)),
(UUID(), 'ADMIN', 'cpe.estimate.manage-all', CURRENT_TIMESTAMP(3)),
(UUID(), 'SYSTEM_ADMIN', 'cpe.executive.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'SYSTEM_ADMIN', 'cpe.sales.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'SYSTEM_ADMIN', 'cpe.estimate.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'SYSTEM_ADMIN', 'cpe.costcheck.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'SYSTEM_ADMIN', 'cpe.bidsim.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'SYSTEM_ADMIN', 'cpe.catalog.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'SYSTEM_ADMIN', 'cpe.forecast.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'SYSTEM_ADMIN', 'cpe.procurement.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'SYSTEM_ADMIN', 'cpe.vendors.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'SYSTEM_ADMIN', 'cpe.projects.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'SYSTEM_ADMIN', 'cpe.cash.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'SYSTEM_ADMIN', 'cpe.knowledge.view', CURRENT_TIMESTAMP(3)),
(UUID(), 'SYSTEM_ADMIN', 'cpe.sales.manage', CURRENT_TIMESTAMP(3)),
(UUID(), 'SYSTEM_ADMIN', 'cpe.estimate.manage', CURRENT_TIMESTAMP(3)),
(UUID(), 'SYSTEM_ADMIN', 'cpe.costcheck.approve', CURRENT_TIMESTAMP(3)),
(UUID(), 'SYSTEM_ADMIN', 'cpe.bidsim.manage', CURRENT_TIMESTAMP(3)),
(UUID(), 'SYSTEM_ADMIN', 'cpe.catalog.manage', CURRENT_TIMESTAMP(3)),
(UUID(), 'SYSTEM_ADMIN', 'cpe.procurement.manage', CURRENT_TIMESTAMP(3)),
(UUID(), 'SYSTEM_ADMIN', 'cpe.procurement.award', CURRENT_TIMESTAMP(3)),
(UUID(), 'SYSTEM_ADMIN', 'cpe.vendors.manage', CURRENT_TIMESTAMP(3)),
(UUID(), 'SYSTEM_ADMIN', 'cpe.projects.manage', CURRENT_TIMESTAMP(3)),
(UUID(), 'SYSTEM_ADMIN', 'cpe.cash.manage', CURRENT_TIMESTAMP(3)),
(UUID(), 'SYSTEM_ADMIN', 'cpe.master.manage', CURRENT_TIMESTAMP(3)),
(UUID(), 'SYSTEM_ADMIN', 'cpe.improvement.propose', CURRENT_TIMESTAMP(3)),
(UUID(), 'SYSTEM_ADMIN', 'cpe.improvement.decide', CURRENT_TIMESTAMP(3)),
(UUID(), 'SYSTEM_ADMIN', 'cpe.sales.manage-all', CURRENT_TIMESTAMP(3)),
(UUID(), 'SYSTEM_ADMIN', 'cpe.estimate.manage-all', CURRENT_TIMESTAMP(3));
