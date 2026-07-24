import { Hono } from "hono";
import { authMiddleware, type Variables } from "../middleware/auth.js";
import { db } from "../db/index.js";
import { driveItems } from "../db/schema/drive-items.js";
import { eq, and, isNull } from "drizzle-orm";

export const mediaRoutes = new Hono<{ Variables: Variables }>();

// Fetch TMDB Movie / TV Show Metadata for media files
mediaRoutes.get("/metadata", authMiddleware, async (c) => {
  const title = c.req.query("title") || "";
  const cleanTitle = title.replace(/\.(mp4|mkv|avi|mov|webm)$/i, "").replace(/[\._\-]/g, " ").trim();

  try {
    const searchUrl = `https://api.themoviedb.org/3/search/multi?api_key=15d2fe9e6d94b0771c110da29c5b62b2&query=${encodeURIComponent(cleanTitle)}`;
    const res = await fetch(searchUrl);
    const data = await res.json() as any;

    if (data.results && data.results.length > 0) {
      const item = data.results[0];
      return c.json({
        data: {
          title: item.title || item.name || cleanTitle,
          overview: item.overview,
          posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
          backdropUrl: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null,
          releaseDate: item.release_date || item.first_air_date,
          rating: item.vote_average,
          mediaType: item.media_type,
        },
      });
    }
  } catch {}

  return c.json({
    data: {
      title: cleanTitle,
      overview: "Media file stored on TDrive NAS.",
      posterUrl: null,
      backdropUrl: null,
      releaseDate: null,
      rating: null,
      mediaType: "video",
    },
  });
});
