/**
 * ImZaDi v2 — Database Seed Script
 * Creates sample blog post with media entries for testing
 */

import { PrismaClient, MediaType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding imzadi_v2 database...');

  // Create sample blog post
  const post = await prisma.blogPost.create({
    data: {
      title: 'The Baby Who Remembers the Future',
      slug: 'the-baby-who-remembers-the-future',
      excerpt: `She woke to the sound of water breathing—not waves exactly, but the shallow, patient inhalation of a lagoon at dawn. A pregnant woman finds herself impossibly stranded on a South Pacific island in 1950, decades before her own birth.

As she struggles to comprehend her displacement through time, a voice emerges from within her womb—not the voice of an infant, but something older, wiser, and heartbreakingly calm.

"You survived the accident," her unborn son tells her. "I didn't. Not really. So I came with you."

What unfolds is an extraordinary journey of survival and acceptance as mother and child navigate an impossible reality together. Stranded in the past with no way home, she must learn to trust the impossible knowledge her son carries—memories of a future that may never come to pass, warnings of dangers she cannot yet see, and glimpses of the life they might have shared.

The island women who take her in speak softly to her swelling belly, sensing what she is only beginning to understand. This two-part narrative explores the profound mystery of consciousness, the boundaries of time, and the fierce bond between a mother and the child who chose to save her by traveling backwards through everything they knew.`,
      featured: true,
      published: true,
      media: {
        create: [
          {
            type: MediaType.AUDIO,
            url: '/audio/the-baby-who-remembers-the-future.mp3',
            title: 'Audio Narration',
            mimeType: 'audio/mpeg',
            metadata: { duration: 1866 },
          },
          {
            type: MediaType.PDF,
            url: '/pdfs/Time-Traveling_Pregnancy_Formatted.pdf',
            title: 'Part I: Time-Traveling Pregnancy',
            mimeType: 'application/pdf',
          },
          {
            type: MediaType.PDF,
            url: '/pdfs/Grounding_the_Impossible.pdf',
            title: 'Part II: Grounding the Impossible',
            mimeType: 'application/pdf',
          },
        ],
      },
    },
  });

  console.log(`Created post: ${post.title} (${post.slug})`);
  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
