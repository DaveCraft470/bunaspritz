// Open-Meteo — free, keyless weather API (no signup, no cost), which is the
// only reason this is in scope at all: same "only if it's free" gate the
// user put on the AI sprint. forecast_days=16 covers most events; anything
// scheduled further out than that just won't have a forecast yet, which is
// also true in reality, not just an API limitation.
const FORECAST_DAYS = 16;

export type WeatherForecast = {
  temperatureC: number;
  precipitationProbability: number;
  weatherCode: number;
  isRainy: boolean;
  isExtreme: boolean;
};

export async function getEventWeather(lat: number, lng: number, startsAt: string): Promise<WeatherForecast | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,precipitation_probability,weathercode&forecast_days=${FORECAST_DAYS}&timezone=auto`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const json = await response.json();
    const times: string[] = json?.hourly?.time ?? [];
    if (!times.length) return null;

    const target = new Date(startsAt).getTime();
    let bestIndex = -1;
    let bestDiff = Infinity;
    times.forEach((time, index) => {
      const diff = Math.abs(new Date(time).getTime() - target);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIndex = index;
      }
    });
    // More than 3 hours off the closest available hour means the event is
    // outside the forecast window — don't show a misleading "closest guess".
    if (bestIndex === -1 || bestDiff > 3 * 60 * 60 * 1000) return null;

    const temperatureC = json.hourly.temperature_2m[bestIndex];
    const precipitationProbability = json.hourly.precipitation_probability[bestIndex];
    const weatherCode = json.hourly.weathercode[bestIndex];
    if (typeof temperatureC !== 'number') return null;

    return {
      temperatureC,
      precipitationProbability: precipitationProbability ?? 0,
      weatherCode: weatherCode ?? 0,
      isRainy: (precipitationProbability ?? 0) >= 50,
      isExtreme: temperatureC >= 33 || temperatureC <= 0,
    };
  } catch {
    return null;
  }
}

// WMO weather codes (open-meteo's `weathercode`), grouped to a representative emoji.
export function weatherEmoji(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 3) return '⛅';
  if (code === 45 || code === 48) return '🌫️';
  if (code >= 51 && code <= 67) return '🌧️';
  if (code >= 71 && code <= 77) return '❄️';
  if (code >= 80 && code <= 82) return '🌦️';
  if (code >= 85 && code <= 86) return '🌨️';
  if (code >= 95) return '⛈️';
  return '🌤️';
}
