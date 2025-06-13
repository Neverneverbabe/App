// modules/episodesSeen.js
import { getCurrentUser, saveUserData, listenToUserCollection } from '../SignIn/firebase_api.js';

let episodesCache = [];
let unsubscribeEpisodes = null;

export function initializeEpisodesListener(onUpdateCallback) {
    if (unsubscribeEpisodes) {
        unsubscribeEpisodes();
        unsubscribeEpisodes = null;
    }
    const user = getCurrentUser();
    if (user) {
        unsubscribeEpisodes = listenToUserCollection('seenEpisodes', (items) => {
            episodesCache = items;
            if (onUpdateCallback) onUpdateCallback();
        });
    } else {
        episodesCache = [];
        if (onUpdateCallback) onUpdateCallback();
    }
}

export function getSeenEpisodesForShow(showId) {
    const record = episodesCache.find(item => String(item.id) === String(showId));
    return record ? (record.episodes || {}) : {};
}

export async function markEpisodesSeen(showId, episodesMap) {
    const user = getCurrentUser();
    if (!user) return;
    await saveUserData('seenEpisodes', String(showId), { id: showId, episodes: episodesMap });
}
