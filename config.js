// App/config.js
export const API_KEY = "e27a888783eeaa67643bd81c5fb4422f";
export const TMDB_BASE_URL = "https://api.themoviedb.org/3";
export const TMDB_IMG_BASE_URL = "https://image.tmdb.org/t/p/w500";
export const TMDB_BACKDROP_BASE_URL = "https://image.tmdb.org/t/p/w1280";
export const TMDB_LOGO_BASE_URL = "https://image.tmdb.org/t/p/w92";

// Region used for "where can I watch this" results (TMDB watch providers,
// powered by JustWatch). Change to your country code if you are not in the US.
export const WATCH_REGION = "US";

// NOTE: The previous VIDSRC_PROVIDERS list was removed on purpose.
// Those third-party embed sites are unauthorised sources whose players are
// funded by click popups, redirects and adult ads — clicking anywhere in
// their player could open an ad tab. This app now uses TMDB watch
// providers (the legal services that carry each title) plus an in-app,
// sandboxed trailer player instead. See modules/player.js and
// IMPROVEMENTS.md ("Playback overhaul").
