import express from 'express';
import axios from 'axios';
import open from 'open';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  SPOTIFY_REDIRECT_URI,
  SPOTIFY_PLAYLIST_ID
} = process.env;

const app = express();
const PORT = 8888;

const authURL = `https://accounts.spotify.com/authorize?` +
  new URLSearchParams({
    response_type: 'code',
    client_id: SPOTIFY_CLIENT_ID,
    scope: 'playlist-modify-public playlist-modify-private',
    redirect_uri: SPOTIFY_REDIRECT_URI,
  });

app.get('/callback', async (req, res) => {
  const code = req.query.code;

  try {
    const tokenRes = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
        client_id: SPOTIFY_CLIENT_ID,
        client_secret: SPOTIFY_CLIENT_SECRET,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const accessToken = tokenRes.data.access_token;

    const songs = JSON.parse(fs.readFileSync('./songs.json', 'utf-8'));

    const trackUris = [];

    for (const song of songs) {
      const q = `track:${song.title} artist:${song.artist}`;
      const searchRes = await axios.get('https://api.spotify.com/v1/search', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { q, type: 'track', limit: 1 }
      });

      const tracks = searchRes.data.tracks.items;
      if (tracks.length > 0) {
        trackUris.push(tracks[0].uri);
        console.log(`✅ Gefunden: ${song.title} – ${song.artist}`);
      } else {
        console.warn(`❌ Nicht gefunden: ${song.title} – ${song.artist}`);
      }
    }

    const existingTrackUris = new Set();

    let nextUrl = `https://api.spotify.com/v1/playlists/${SPOTIFY_PLAYLIST_ID}/tracks?limit=100`;
    while (nextUrl) {
    const response = await axios.get(nextUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    response.data.items.forEach(item => {
        if (item.track && item.track.uri) {
        existingTrackUris.add(item.track.uri);
        }
    });
    nextUrl = response.data.next;
    }

    // Filtere die URIs, die **nicht** schon in der Playlist sind
    const newTrackUris = trackUris.filter(uri => !existingTrackUris.has(uri));

    if (newTrackUris.length > 0) {
    await axios.post(
        `https://api.spotify.com/v1/playlists/${SPOTIFY_PLAYLIST_ID}/tracks`,
        { uris: newTrackUris },
        { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    console.log('🎉 Neue Songs wurden zur Playlist hinzugefügt!');
    } else {
    console.log('🔁 Alle Songs sind bereits in der Playlist – nichts hinzugefügt.');
    }

    res.send('Fertig! Du kannst dieses Fenster schließen.');
    server.close();
  } catch (err) {
    console.error('Fehler bei Auth oder Hinzufügen:', err.response?.data || err.message);
    res.send('Fehler. Details siehe Konsole.');
    server.close();
  }
});

const server = app.listen(PORT, () => {
  console.log(`🔓 Öffne Spotify Login...`);
  open(authURL);
});
