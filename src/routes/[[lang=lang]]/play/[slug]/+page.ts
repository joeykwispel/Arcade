import { error } from '@sveltejs/kit';
import { gameBySlug } from '$lib/games';
import type { PageLoad } from './$types';

// Pages are found by the prerender crawler through the links on both home pages.
export const load: PageLoad = ({ params }) => {
  const game = gameBySlug(params.slug);
  if (!game) error(404, 'Not found');
  return { game };
};
