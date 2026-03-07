import { PrismaClient } from '../src/generated/prisma/client';

async function main() {
    const prisma = new PrismaClient();
    try {
        const cameras = await prisma.camera.findMany({
            where: {
                OR: [
                    { name: { contains: 'TNO-real', mode: 'insensitive' } },
                    { cameraId: { contains: 'TNO-real', mode: 'insensitive' } }
                ]
            }
        });

        console.log(`Found ${cameras.length} cameras matching "TNO-real":`);
        for (const c of cameras) {
            console.log(`- ID: ${c.cameraId}, Name: ${c.name}`);
        }

        if (cameras.length > 0) {
            const ids = cameras.map(c => c.cameraId);

            // Since models have on-delete cascade (mostly), this should work:
            const result = await prisma.camera.deleteMany({
                where: {
                    cameraId: { in: ids }
                }
            });
            console.log(`Successfully deleted ${result.count} cameras (and related readings/alerts via cascade).`);
        } else {
            console.log('No cameras found.');
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
