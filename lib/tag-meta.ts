// Tag-page meta descriptions, verbatim from Molly's 2026-10-07 ImZaDi cleanup package
// (Section 4, "Tag meta descriptions"), approved by James on 2026-10-07.
// Keyed by the lower-cased tag *name* so they work whatever slug the DB holds.

export const SITE_URL = (process.env.NEXTAUTH_URL || 'https://imzadi.love').replace(/\/$/, '');

export const TAG_DESCRIPTIONS: Record<string, string> = {
  "drama": "Drama on ImZaDi: marriages, grief, family secrets and second chances, told close and plainly, from a first love to the long road after a loss.",
  "family": "Family stories on ImZaDi: parents, children, siblings and chosen kin, through births, funerals, reunions and the quiet work of staying together.",
  "romance": "Romance on ImZaDi: first love, reunions after thirty years, weddings and devotion that lasts, written close to the heart and to the people in it.",
  "sci-fi": "Science fiction on ImZaDi: near-future labs, a starship, quantum breaks and new kinds of family, grounded in the people who have to live through them.",
  "coming-of-age": "Coming-of-age stories on ImZaDi: young people choosing love, duty and who they will be, from a first day of high school to an eighteen-year-old's crown.",
  "faith": "Stories of faith on ImZaDi: prayer, worship and belief carried through grief, addiction and love, written plainly, close to the people, without preaching.",
  "tragedy": "Tragedy on ImZaDi: stories of loss and leaving, a goodbye written backward on a mirror, lovers lost, and what the people left behind carry next.",
  "thriller": "Thrillers on ImZaDi: a quantum machine that can break the world's codes, an isolated compound in 2030 Texas, and the people caught inside the danger.",
  "speculative": "Speculative fiction on ImZaDi: the world bends in one strange way, and the story stays with the people, the bodies and the rooms that it changes.",
  "suspense": "Suspense on ImZaDi: slow-building stories where a secret, a machine or a deadline tightens around the people in the room, one quiet beat at a time.",
};

/** Meta description for a tag page; generic fallback for tags added later. */
export function tagDescription(name: string): string {
  return TAG_DESCRIPTIONS[name.trim().toLowerCase()] ?? `${name} stories on ImZaDi.`;
}
