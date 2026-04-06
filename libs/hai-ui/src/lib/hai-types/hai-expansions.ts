export const HAI_EXPANSIONS = [
  'Highly Arbitrary Initialism',
  'Heavily Articulated Iguanas',
  'Holographic Artichoke Investors',
  'Haphazard Algorithm Incubator',
  'Habitually Arguing Idiots',
  'Half-baked Artificial Intelligence',
  'Hovering Alien Invaders',
  'Hypnotic Avocado Illusion',
  'Heavy Analytical Instruments',
  'Harmlessly Absurd Interlopers',
  'Hollow Administrative Ideas',
  'Heroic Aardvark Innovations',
  'Historical Anomaly Investigators',
  'Hidden API Illuminati',
  'Homesteaders Against Interfaces',
  'Haunted Architecture Inc.',
];

export function getRandomHaiExpansion(): string {
  const randomIndex = Math.floor(Math.random() * HAI_EXPANSIONS.length);
  return HAI_EXPANSIONS[randomIndex];
}
