/**
 * Photo manifest.
 *
 * The prototype embedded these 30 images as base64 inside the HTML, because
 * the artifact sandbox blocks every remote image origin. That made the single
 * file 2MB, of which 1.9MB was pictures - paid for on first paint, by users
 * who are disproportionately on prepaid data and older phones.
 *
 * Served as real files they are cached, requested in parallel, lazy-loaded
 * below the fold, and never block first paint. This is the largest
 * perceived-speed win available in the whole app, and it is not an animation.
 */
const files = import.meta.glob('../public/photos/*.{jpg,png}', { eager: true, query: '?url', import: 'default' });

export const PHOTOS = Object.fromEntries(
  Object.entries(files).map(([p, url]) => [p.replace(/.*\/(.+)\.(jpg|png)$/, '$1'), url]),
);

export const photo = key => PHOTOS[key] || null;
