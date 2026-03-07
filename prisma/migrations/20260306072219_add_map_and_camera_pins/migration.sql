-- AlterTable
ALTER TABLE "groups" ADD COLUMN     "map_image" TEXT;

-- CreateTable
CREATE TABLE "camera_pins" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "camera_id" TEXT NOT NULL,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,

    CONSTRAINT "camera_pins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "camera_pins_group_id_idx" ON "camera_pins"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "camera_pins_group_id_camera_id_key" ON "camera_pins"("group_id", "camera_id");

-- AddForeignKey
ALTER TABLE "camera_pins" ADD CONSTRAINT "camera_pins_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "camera_pins" ADD CONSTRAINT "camera_pins_camera_id_fkey" FOREIGN KEY ("camera_id") REFERENCES "cameras"("camera_id") ON DELETE CASCADE ON UPDATE CASCADE;
