import { PrismaClient } from '@/generated/prisma';

async function main() {
    const prisma = new PrismaClient();
    try {
        const cameras = await prisma.camera.findMany({
            select: { cameraId: true, name: true }
        });
        console.log('Current Cameras in DB:');
        cameras.forEach(c => console.log(`- ${c.cameraId}: ${c.name}`));
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
