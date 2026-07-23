/**
 * ImZaDi v2 — Database Health Check
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking imzadi_v2 database connection...');
  
  try {
    await prisma.$connect();
    const postCount = await prisma.blogPost.count();
    const mediaCount = await prisma.media.count();
    console.log(`✓ Database connected`);
    console.log(`  - Blog posts: ${postCount}`);
    console.log(`  - Media entries: ${mediaCount}`);
  } catch (error) {
    console.error('✗ Database connection failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
