// ─────────────────────────────────────────────────────────────
//  KRYZEN — Serveur relais Fortnite
//  Cache ta clé API et fournit des stats propres à l'overlay.
// ─────────────────────────────────────────────────────────────
const express = require("express");
const app = express();

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.FORTNITE_API_KEY;   // défini dans Render
const DEFAULT_NAME = process.env.PLAYER_NAME || "guido pit stop";

// Petit cache en mémoire pour ne pas spammer l'API (et rester dans le free tier)
let cache = { data: null, name: null, time: 0 };
const CACHE_MS = 60 * 1000; // 60 s

// CORS : autorise l'overlay (et OBS) à lire l'endpoint depuis n'importe où
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});

app.get("/", (req, res) => {
  res.send("KRYZEN relay OK. Utilise /stats?name=PSEUDO");
});

app.get("/stats", async (req, res) => {
  const name = (req.query.name || DEFAULT_NAME).trim();

  // Sert le cache si récent et même joueur
  if (cache.data && cache.name === name && Date.now() - cache.time < CACHE_MS) {
    return res.json(cache.data);
  }

  if (!API_KEY) {
    return res.status(500).json({ error: "FORTNITE_API_KEY manquante côté serveur" });
  }

  try {
    const url =
      "https://fortnite-api.com/v2/stats/br/v2?name=" +
      encodeURIComponent(name);

    const r = await fetch(url, {
      headers: { Authorization: API_KEY },
    });

    if (!r.ok) {
      const txt = await r.text();
      return res.status(r.status).json({ error: "API error", detail: txt });
    }

    const json = await r.json();
    const d = json.data || {};
    const overall = (d.stats && d.stats.all && d.stats.all.overall) || {};
    const ranked = d.battlePass || {};

    // On normalise pour l'overlay : seulement ce dont il a besoin
    const out = {
      name: d.account ? d.account.name : name,
      wins: overall.wins ?? null,
      kills: overall.kills ?? null,
      matches: overall.matches ?? null,
      kd: overall.kd ?? null,
      winRate: overall.winRate ?? null,
      top1: overall.top1 ?? overall.wins ?? null,
      level: ranked.level ?? null,
      updated: Date.now(),
    };

    cache = { data: out, name, time: Date.now() };
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: "fetch failed", detail: String(e) });
  }
});

app.listen(PORT, () => console.log("KRYZEN relay écoute sur :" + PORT));
