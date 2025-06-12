// App/ratingUtils.js
/**
 * Extracts the US certification (age rating) from a TMDB item.
 * @param {object} item - The movie or TV show object from TMDB.
 * @returns {string} The certification string (e.g., 'PG-13', 'TV-MA') or 'N/A'.
 */
export function getCertification(item) {
    // For movies
    const movieCert = item.release_dates?.results
        ?.find(r => r.iso_3166_1 === 'US')
        ?.release_dates?.find(rd => rd.certification)?.certification;
    if (movieCert) return movieCert;

    // For TV shows
    const tvCert = item.content_ratings?.results
        ?.find(r => r.iso_3166_1 === 'US')
        ?.rating;
    if (tvCert) return tvCert;

    return 'N/A';
}

/**
 * Checks if an item's certification is compatible with the selected filters.
 * @param {string} itemCertification - The certification of the item (e.g., 'PG', 'TV-G').
 * @param {string[]} filterCertifications - An array of selected filter certifications (e.g., ['PG', 'R']).
 * An empty array or an array containing "" means "All Ratings".
 * @returns {boolean} True if the item is compatible with the filters, false otherwise.
 */
export function checkRatingCompatibility(itemCertification, filterCertifications) {
    // If no specific filters are applied or "All Ratings" is explicitly selected
    if (!filterCertifications || filterCertifications.length === 0 || filterCertifications.includes("")) {
        return true;
    }
    // If the certification is unknown, assume compatibility since some API
    // responses (e.g., discover or search) do not include rating data even
    // when a certification filter was applied at the request level.
    if (itemCertification === 'N/A') {
        return true;
    }
    // Check if the item's certification is present in the list of selected filters
    return filterCertifications.includes(itemCertification);
}
