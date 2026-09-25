import type { ParamMatcher } from '@sveltejs/kit';

/** English lives at the root, Dutch under /nl/. */
export const match: ParamMatcher = (param) => param === 'nl';
