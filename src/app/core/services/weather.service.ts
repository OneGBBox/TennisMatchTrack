import { Injectable } from '@angular/core';
import { MatchWeather } from '../models/match.model';

// ── Open-Meteo (free, no API key) ────────────────────────────────────────────
const GEO_URL     = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';

// WMO weather-code → human-readable condition
// https://open-meteo.com/en/docs#weathervariables
const WMO_CONDITIONS: Record<number, string> = {
  0:  'Clear',
  1:  'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
  45: 'Fog',          48: 'Icy Fog',
  51: 'Light Drizzle', 53: 'Drizzle',     55: 'Heavy Drizzle',
  61: 'Light Rain',   63: 'Rain',          65: 'Heavy Rain',
  71: 'Light Snow',   73: 'Snow',          75: 'Heavy Snow',
  80: 'Showers',      81: 'Showers',       82: 'Heavy Showers',
  95: 'Thunderstorm', 96: 'Thunderstorm',  99: 'Thunderstorm'
};

export interface WeatherResult {
  weather:  MatchWeather;
  cityName: string;   // resolved / normalised city name from geocoder
}

@Injectable({ providedIn: 'root' })
export class WeatherService {

  /**
   * Fetch current weather for a city string.
   * Returns null if the city cannot be geocoded or the request fails.
   */
  async fetchForCity(city: string): Promise<WeatherResult | null> {
    if (!city.trim()) return null;

    try {
      // ── Step 1: Geocode city name ────────────────────────────
      const geoRes = await fetch(
        `${GEO_URL}?name=${encodeURIComponent(city.trim())}&count=1&language=en&format=json`
      );
      if (!geoRes.ok) return null;

      const geoJson = await geoRes.json();
      const loc = geoJson?.results?.[0];
      if (!loc) return null;

      const { latitude, longitude, name: cityName } = loc;

      // ── Step 2: Fetch current weather ────────────────────────
      const wRes = await fetch(
        `${WEATHER_URL}?latitude=${latitude}&longitude=${longitude}` +
        `&current=temperature_2m,wind_speed_10m,weather_code` +
        `&wind_speed_unit=kmh&temperature_unit=celsius&timezone=auto`
      );
      if (!wRes.ok) return null;

      const wJson = await wRes.json();
      const cur   = wJson?.current;
      if (!cur) return null;

      const code      = cur.weather_code ?? 0;
      const condition = WMO_CONDITIONS[code] ?? 'Unknown';

      return {
        cityName,
        weather: {
          condition,
          temp_c:   Math.round(cur.temperature_2m ?? 0),
          wind_kph: Math.round(cur.wind_speed_10m ?? 0)
        }
      };
    } catch {
      return null;
    }
  }

  /** Pick an emoji for a weather condition string. */
  static icon(condition: string): string {
    const c = condition.toLowerCase();
    if (c.includes('thunder'))               return '⛈️';
    if (c.includes('snow'))                  return '❄️';
    if (c.includes('rain') || c.includes('shower') || c.includes('drizzle')) return '🌧️';
    if (c.includes('fog'))                   return '🌫️';
    if (c.includes('overcast'))              return '☁️';
    if (c.includes('partly') || c.includes('mainly')) return '⛅';
    if (c.includes('clear') || c.includes('sun'))     return '☀️';
    return '🌤️';
  }
}
