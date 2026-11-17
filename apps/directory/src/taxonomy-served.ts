/**
 * SQL shared by every public read and the reclassification runner (S7d): how a served row's effective category and
 * exclusion are derived. Order of authority:
 *
 *   1. an active per-listing override, found through the listing's stable identity (the business id when the row
 *      has a current assertion, else the row-scoped listing id), so it applies to a rescanned row too;
 *   2. the persisted classification of this row (`directory_listing_classification`);
 *   3. the stored category (`listing.category`), so a row with no projection keeps its label and nothing
 *      disappears before a reclassification run has covered it.
 *
 * An override beats an exclusion: an operator who assigns a category to an excluded listing serves it.
 */
export const CLASSIFICATION_JOINS = `
      LEFT JOIN directory_listing_classification lc ON lc."scanId"=r."scanId" AND lc."sourceFileRowNumber"=r."sourceFileRowNumber"
      LEFT JOIN LATERAL (SELECT o."categoryId", o."placeTypeId" FROM directory_listing_category_override o
        WHERE o.active AND o."communityId"::text=r."regionId"
          AND (o."listingKey" IN (SELECT a."businessId" FROM directory_business_assertion a
                 WHERE a."scanId"=r."scanId" AND a."sourceFileRowNumber"=r."sourceFileRowNumber" AND a.state='current')
            OR o."listingKey" IN (SELECT i.id FROM directory_listing_identity i
                 WHERE i."scanId"=r."scanId" AND i."sourceFileRowNumber"=r."sourceFileRowNumber"))
        LIMIT 1) ov ON true`;

/** The category a public read filters and labels by. */
export const EFFECTIVE_CATEGORY_SQL = `COALESCE(ov."categoryId", lc."categoryId", r.listing->>'category')`;

/** True for a row the active classification keeps out of the directory. */
export const CLASSIFICATION_EXCLUDED_SQL = `(ov."categoryId" IS NULL AND COALESCE(lc.excluded, false))`;
