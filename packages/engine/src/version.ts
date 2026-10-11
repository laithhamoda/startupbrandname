/**
 * Version of the calculation engine, stored on every tool run (`tool_runs.engine_version`) so
 * cached outputs are recomputed when a formula changes. 1.0.0 is the engine M4 completes: T7, T8,
 * T9 and its tax, cash flow and FX test, and T10 (D-178, D-217). 1.1.0 adds the feasibility score,
 * the verdict, overall confidence and the validation plan T18 (D-227, D-229, D-230, D-246). Bump it
 * whenever an output can change: the golden files show the change as a diff.
 */
export const ENGINE_VERSION = '1.1.0';
