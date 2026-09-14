/**
 * One photograph.
 *
 * Three things make this feel faster than the prototype's background images,
 * and none of them is an animation:
 *   - a real <img> can be lazy-loaded and decoded off the main thread;
 *   - the gradient underneath is the first paint, so nothing is ever a blank
 *     rectangle waiting;
 *   - the fade is per-image on decode, so a slow photo does not hold up its
 *     neighbours.
 *
 * `decoding="async"` and `fetchPriority` matter on the phones this audience
 * actually uses: the hero should jump the queue, a rail three screens down
 * should not.
 */
import { useState } from 'react';
import { photo } from '../photos.js';

export default function Photo({ name, alt = '', priority = false, className = '' }) {
  const [ready, setReady] = useState(false);
  const src = photo(name);
  if (!src) return <span className={`art ${className}`} aria-hidden="true" />;
  return (
    <span className={`art ${className}`} aria-hidden={alt ? undefined : 'true'}>
      <img
        src={src}
        alt={alt}
        className={ready ? 'ready' : ''}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchpriority={priority ? 'high' : 'low'}
        onLoad={() => setReady(true)}
        onError={() => setReady(true)}
      />
    </span>
  );
}
