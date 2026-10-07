-- ImZaDi: read-only check. Published-post count per tag.
-- Expected after apply.sql: Drama 11, Family 9, Romance 8, Sci-Fi 7, Coming-of-Age 3,
-- Faith 3, Thriller 2, Tragedy 2, Speculative 1, Suspense 1. Last Horizon: Drama, Sci-Fi.
SELECT t.name, t.slug, count(p.id) AS published_posts
FROM "Tag" t
LEFT JOIN "_PostTags" pt ON pt."B" = t.id
LEFT JOIN "BlogPost" p ON p.id = pt."A" AND p.published
GROUP BY t.name, t.slug
ORDER BY published_posts DESC, t.name;

SELECT p.slug, p.title, coalesce(string_agg(t.name, ', ' ORDER BY t.name), '(none)') AS tags
FROM "BlogPost" p
LEFT JOIN "_PostTags" pt ON pt."A" = p.id
LEFT JOIN "Tag" t ON t.id = pt."B"
WHERE p.slug = 'last-horizon'
GROUP BY p.slug, p.title;
