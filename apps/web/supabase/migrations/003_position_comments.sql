-- Corrects two column comments in 001 that describe a design which was replaced before
-- either column carried production data.
--
-- 001 shipped with the client sending a `positions` map that the server verified and
-- stored, so its comments say the map is "stored verbatim rather than reconstructed
-- from the seed" and that render_id makes "a forged positions map detectable". Neither
-- is true now: the server derives the map itself from (render_id, config_version, node)
-- and ignores anything the body claims, because two sources of truth for the rendered
-- order produced four separate defects — including a verification rule that rejected
-- every genuine submission. See docs/design/attribution-pivot.md §5.3.
--
-- The column semantics did not change, so this is a documentation fix rather than a
-- schema change. It exists as its own migration because 001 is already applied and
-- editing an applied migration is what the runner's checksum drift detector exists to
-- catch; the correction belongs where a maintainer reading the live schema will find it.

COMMENT ON COLUMN attribution_responses.render_id IS
  $$Client-minted before first paint. The seed for the `rotate` permutation — which cannot be the response id, since that is generated server-side inside the POST, i.e. after the first render. The server re-derives the whole impressions map from this plus (config_version, node), so the rendered order is reproducible from the row rather than trusted from the request.$$;

COMMENT ON COLUMN attribution_responses.positions IS
  $${node_id: {candidate_id: rendered_index}}, DERIVED SERVER-SIDE, never accepted from the request body. Covers the initial unfiltered render of each node; pinned candidates are excluded, matching the position model's rule that they take part in neither rotation nor the fit. A search-filtered pick is recorded with a null position rather than its index. Aggregated at read time with jsonb_each_text; if that gets slow the escape hatch is a derived projection table, rebuildable from this column.$$;
