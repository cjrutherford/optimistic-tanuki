import { readFileSync } from 'fs';
import { join } from 'path';

interface SeedLocality {
  slug: string;
  localityType: string;
  lat: number;
  lng: number;
}

interface SeedFile {
  localities: SeedLocality[];
}

// Contiguous US, Alaska, Hawaii and the territories fit within this box.
const US_BOUNDS = { minLat: 17.5, maxLat: 72, minLng: -180, maxLng: -64 };

const socialPath = join(__dirname, 'seed-cities.json');
const localHubPath = join(
  __dirname,
  '..',
  '..',
  '..',
  'local-hub',
  'src',
  'data',
  'seed-cities.json'
);

describe('seed-cities.json', () => {
  const seed: SeedFile = JSON.parse(readFileSync(socialPath, 'utf8'));
  const places = seed.localities.filter(
    (l) => l.localityType === 'city' || l.localityType === 'town'
  );

  it('has cities and towns', () => {
    expect(places.length).toBeGreaterThan(0);
  });

  it('keeps every city and town inside valid lat/lng', () => {
    const bad = places.filter(
      (l) =>
        !Number.isFinite(l.lat) ||
        !Number.isFinite(l.lng) ||
        Math.abs(l.lat) > 90 ||
        Math.abs(l.lng) > 180
    );
    expect(bad.map((l) => l.slug)).toEqual([]);
  });

  it('keeps every city and town inside the US bounding box', () => {
    const bad = places.filter(
      (l) =>
        l.lat < US_BOUNDS.minLat ||
        l.lat > US_BOUNDS.maxLat ||
        l.lng < US_BOUNDS.minLng ||
        l.lng > US_BOUNDS.maxLng
    );
    expect(bad.map((l) => l.slug)).toEqual([]);
  });

  it('is identical to the Local Hub copy', () => {
    expect(readFileSync(localHubPath, 'utf8')).toBe(
      readFileSync(socialPath, 'utf8')
    );
  });
});
