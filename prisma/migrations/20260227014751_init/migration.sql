-- CreateEnum
CREATE TYPE "CameraStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('TEMPERATURE', 'GAP');

-- CreateEnum
CREATE TYPE "GapDirection" AS ENUM ('RISE', 'DROP', 'BOTH');

-- CreateTable
CREATE TABLE "cameras" (
    "camera_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "status" "CameraStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cameras_pkey" PRIMARY KEY ("camera_id")
);

-- CreateTable
CREATE TABLE "readings" (
    "id" BIGSERIAL NOT NULL,
    "camera_id" TEXT NOT NULL,
    "celsius" REAL NOT NULL,
    "timestamp" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "temperature_thresholds" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "camera_id" TEXT,
    "min_celsius" REAL,
    "max_celsius" REAL,
    "cooldown_minutes" INTEGER NOT NULL DEFAULT 5,
    "notify_email" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "temperature_thresholds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gap_thresholds" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "camera_id" TEXT,
    "interval_minutes" INTEGER NOT NULL,
    "max_gap_celsius" REAL NOT NULL,
    "direction" "GapDirection" NOT NULL DEFAULT 'BOTH',
    "cooldown_minutes" INTEGER NOT NULL DEFAULT 5,
    "notify_email" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "gap_thresholds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "camera_id" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "message" TEXT NOT NULL,
    "celsius" REAL NOT NULL,
    "threshold_value" REAL,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledged_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "readings_camera_id_timestamp_idx" ON "readings"("camera_id", "timestamp");

-- CreateIndex
CREATE INDEX "alerts_camera_id_created_at_idx" ON "alerts"("camera_id", "created_at");

-- CreateIndex
CREATE INDEX "alerts_acknowledged_idx" ON "alerts"("acknowledged");

-- AddForeignKey
ALTER TABLE "readings" ADD CONSTRAINT "readings_camera_id_fkey" FOREIGN KEY ("camera_id") REFERENCES "cameras"("camera_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_camera_id_fkey" FOREIGN KEY ("camera_id") REFERENCES "cameras"("camera_id") ON DELETE CASCADE ON UPDATE CASCADE;
