export interface SeedChassis {
  slug: string;
  type: 'XS' | 'S' | 'M' | 'L';
  useCase: 'cloud' | 'nas' | 'dev' | 'hybrid' | 'enterprise';
  name: string;
  description: string;
  basePrice: number;
  specifications: Record<string, string>;
}

export interface SeedCaseOption {
  chassisSlug: string;
  title: string;
  optionType: 'commercial' | 'printable';
  vendor?: string;
  sourceName: string;
  sourceUrl: string;
  priceLabel: string;
  priceMin?: number;
  priceMax?: number;
  features: string[];
  isRecommended?: boolean;
}

export interface SeedPart {
  slug: string;
  category: 'cpu' | 'ram' | 'storage' | 'gpu';
  vendor?: string;
  name: string;
  description: string;
  basePrice: number;
  sellingPrice: number;
  specs: Record<string, string | number>;
  compatibleChassisSlugs: string[];
  sourceType?: 'curated' | 'pcpartpicker';
}

export const CHASSIS_SEED: SeedChassis[] = [
  {
    slug: 'xs-cloud',
    type: 'XS',
    useCase: 'cloud',
    name: 'HAI XS Cloud Node',
    description:
      'Raspberry Pi 5 cloud edge node with compact enclosure and low-power deployment profile.',
    basePrice: 16,
    specifications: {
      formFactor: 'Raspberry Pi 5 enclosure',
      maxPower: '27W USB-C PD',
      noiseLevel: 'Passive or near-silent',
      dimensions: 'Pi-class compact',
    },
  },
  {
    slug: 'xs-nas',
    type: 'XS',
    useCase: 'nas',
    name: 'HAI XS Archive Node',
    description:
      'Raspberry Pi 5 NAS chassis profile for compact backup and archive deployments.',
    basePrice: 30,
    specifications: {
      formFactor: 'Pi 5 NAS enclosure',
      maxPower: '45W typical',
      noiseLevel: 'Low',
      dimensions: 'Pi-class NAS stack',
    },
  },
  {
    slug: 'xs-dev',
    type: 'XS',
    useCase: 'dev',
    name: 'HAI XS Dev Bench',
    description:
      'Raspberry Pi 5 dev workstation profile with GPIO-friendly enclosure options.',
    basePrice: 15,
    specifications: {
      formFactor: 'Open Pi 5 dev enclosure',
      maxPower: '27W USB-C PD',
      noiseLevel: 'Low',
      dimensions: 'Pi-class dev stack',
    },
  },
  {
    slug: 's-cloud',
    type: 'S',
    useCase: 'cloud',
    name: 'HAI S Cloud Mini',
    description:
      'Mini PC and NUC-aligned cloud node profile for compact quiet compute.',
    basePrice: 90,
    specifications: {
      formFactor: 'Mini PC / NUC',
      maxPower: '120W typical',
      noiseLevel: 'Fanless to low',
      dimensions: 'NUC-sized compact',
    },
  },
  {
    slug: 's-nas',
    type: 'S',
    useCase: 'nas',
    name: 'HAI S Compact NAS',
    description:
      'Small-form-factor NAS profile with multi-bay case support for compact storage.',
    basePrice: 80,
    specifications: {
      formFactor: 'Mini-ITX NAS',
      maxPower: '300W typical',
      noiseLevel: 'Low to moderate',
      dimensions: 'Compact multi-bay',
    },
  },
  {
    slug: 'm-cloud',
    type: 'M',
    useCase: 'cloud',
    name: 'HAI M Console Compute',
    description:
      'Console-size cloud and workstation chassis profile with slim desktop footprint.',
    basePrice: 80,
    specifications: {
      formFactor: 'Console / slim tower',
      maxPower: '650W typical',
      noiseLevel: 'Moderate',
      dimensions: 'Console-sized',
    },
  },
  {
    slug: 'm-nas',
    type: 'M',
    useCase: 'nas',
    name: 'HAI M Storage Console',
    description:
      'Console-size NAS profile with denser drive accommodation for home or office storage.',
    basePrice: 100,
    specifications: {
      formFactor: 'Compact NAS console',
      maxPower: '650W typical',
      noiseLevel: 'Moderate',
      dimensions: 'Compact multi-bay console',
    },
  },
  {
    slug: 'l-cloud',
    type: 'L',
    useCase: 'cloud',
    name: 'HAI L Tower Compute',
    description:
      'Full tower workstation and cloud chassis profile for high-capacity expansion and quieter cooling.',
    basePrice: 85,
    specifications: {
      formFactor: 'Full tower',
      maxPower: '850W+ typical',
      noiseLevel: 'Moderate to quiet',
      dimensions: 'Full tower',
    },
  },
  {
    slug: 'l-nas',
    type: 'L',
    useCase: 'nas',
    name: 'HAI L Archive Tower',
    description:
      'Full tower NAS chassis profile focused on drive density and long-term storage capacity.',
    basePrice: 140,
    specifications: {
      formFactor: 'Full tower NAS',
      maxPower: '850W+ typical',
      noiseLevel: 'Moderate',
      dimensions: 'Full tower high-capacity',
    },
  },
];

export const CASE_OPTION_SEED: SeedCaseOption[] = [
  { chassisSlug: 'xs-cloud', title: 'Official Pi 5 Case', optionType: 'commercial', vendor: 'Raspberry Pi', sourceName: 'raspberrypi.com', sourceUrl: 'https://www.raspberrypi.com/', priceLabel: '$10', priceMin: 10, priceMax: 10, features: ['Basic enclosure', 'Passive cooling', 'Minimalist'], isRecommended: false },
  { chassisSlug: 'xs-cloud', title: 'Flirc Pi 5 Case', optionType: 'commercial', vendor: 'Flirc', sourceName: 'flirc.tv', sourceUrl: 'https://flirc.tv/', priceLabel: '$16', priceMin: 16, priceMax: 16, features: ['Aluminum', 'Passive cooling', 'Premium feel'], isRecommended: true },
  { chassisSlug: 'xs-cloud', title: 'Argon NEO 5', optionType: 'commercial', vendor: 'Argon40', sourceName: 'argon40.com', sourceUrl: 'https://argon40.com/', priceLabel: '$20', priceMin: 20, priceMax: 20, features: ['Aluminum', 'Active cooling option', 'Sleek design'], isRecommended: true },
  { chassisSlug: 'xs-cloud', title: 'Pibow Coupe 5', optionType: 'commercial', vendor: 'Pimoroni', sourceName: 'pimoroni.com', sourceUrl: 'https://pimoroni.com/', priceLabel: '$15', priceMin: 15, priceMax: 15, features: ['Stacked layers', 'Colorful', 'GPIO access'] },
  { chassisSlug: 'xs-cloud', title: '3D Print Minimal', optionType: 'printable', sourceName: 'Thingiverse #6090022', sourceUrl: 'https://www.thingiverse.com/thing:6090022', priceLabel: '$2-5', priceMin: 2, priceMax: 5, features: ['Simple enclosure', 'Vented'], isRecommended: false },
  { chassisSlug: 'xs-cloud', title: '3D Print NVMe Slot', optionType: 'printable', sourceName: 'Thingiverse #6234518', sourceUrl: 'https://www.thingiverse.com/thing:6234518', priceLabel: '$3-8', priceMin: 3, priceMax: 8, features: ['Space for M.2 HAT+'], isRecommended: false },
  { chassisSlug: 'xs-nas', title: 'Geekworm X1001', optionType: 'commercial', vendor: 'Geekworm', sourceName: 'geekworm.com', sourceUrl: 'https://geekworm.com/', priceLabel: '$30', priceMin: 30, priceMax: 30, features: ['4-bay NAS HAT', 'Clean design'], isRecommended: true },
  { chassisSlug: 'xs-nas', title: 'Argon EON', optionType: 'commercial', vendor: 'Argon40', sourceName: 'argon40.com', sourceUrl: 'https://argon40.com/', priceLabel: '$70', priceMin: 70, priceMax: 70, features: ['4-bay NAS', 'All-in-one', 'Premium'], isRecommended: true },
  { chassisSlug: 'xs-nas', title: 'UCTRONICS PoE', optionType: 'commercial', vendor: 'UCTRONICS', sourceName: 'uctronics.com', sourceUrl: 'https://www.uctronics.com/', priceLabel: '$35', priceMin: 35, priceMax: 35, features: ['PoE powered', '1-bay'] },
  { chassisSlug: 'xs-nas', title: '3D Print Open Frame', optionType: 'printable', sourceName: 'Thingiverse #5587321', sourceUrl: 'https://www.thingiverse.com/thing:5587321', priceLabel: '$5-15', priceMin: 5, priceMax: 15, features: ['Shows drives', 'Industrial look'] },
  { chassisSlug: 'xs-nas', title: '3D Print Enclosed', optionType: 'printable', sourceName: 'Thingiverse #5890456', sourceUrl: 'https://www.thingiverse.com/thing:5890456', priceLabel: '$8-20', priceMin: 8, priceMax: 20, features: ['Clean enclosed', '4-bay'] },
  { chassisSlug: 'xs-nas', title: '3D Print Stackable', optionType: 'printable', sourceName: 'Thingiverse #6123456', sourceUrl: 'https://www.thingiverse.com/thing:6123456', priceLabel: '$10-25', priceMin: 10, priceMax: 25, features: ['Stack units vertically'] },
  { chassisSlug: 'xs-dev', title: 'Pibow Coupe 5', optionType: 'commercial', vendor: 'Pimoroni', sourceName: 'pimoroni.com', sourceUrl: 'https://pimoroni.com/', priceLabel: '$15', priceMin: 15, priceMax: 15, features: ['Stacked layers', 'GPIO exposed'], isRecommended: true },
  { chassisSlug: 'xs-dev', title: 'Argon NEO 5', optionType: 'commercial', vendor: 'Argon40', sourceName: 'argon40.com', sourceUrl: 'https://argon40.com/', priceLabel: '$20', priceMin: 20, priceMax: 20, features: ['GPIO accessible through top'], isRecommended: false },
  { chassisSlug: 'xs-dev', title: '3D Print GPIO Access', optionType: 'printable', sourceName: 'Thingiverse #6087234', sourceUrl: 'https://www.thingiverse.com/thing:6087234', priceLabel: '$2-5', priceMin: 2, priceMax: 5, features: ['Open top for GPIO'] },
  { chassisSlug: 'xs-dev', title: '3D Print Fan Mount', optionType: 'printable', sourceName: 'Thingiverse #6156789', sourceUrl: 'https://www.thingiverse.com/thing:6156789', priceLabel: '$3-8', priceMin: 3, priceMax: 8, features: ['40mm fan mount on top'], isRecommended: true },
  { chassisSlug: 'xs-dev', title: '3D Print Display Mount', optionType: 'printable', sourceName: 'Thingiverse #6045678', sourceUrl: 'https://www.thingiverse.com/thing:6045678', priceLabel: '$5-12', priceMin: 5, priceMax: 12, features: ['Screen holder integrated'] },
  { chassisSlug: 's-cloud', title: 'Akasa Turing', optionType: 'commercial', vendor: 'Akasa', sourceName: 'akasa.com', sourceUrl: 'https://www.akasa.com/', priceLabel: '$120', priceMin: 120, priceMax: 120, features: ['Fanless aluminum', 'Premium'], isRecommended: true },
  { chassisSlug: 's-cloud', title: 'Akasa X72 Pro', optionType: 'commercial', vendor: 'Akasa', sourceName: 'akasa.com', sourceUrl: 'https://www.akasa.com/', priceLabel: '$90', priceMin: 90, priceMax: 90, features: ['Fanless', 'Compact'] },
  { chassisSlug: 's-cloud', title: 'Intel NUC Case', optionType: 'commercial', vendor: 'Intel', sourceName: 'intel.com', sourceUrl: 'https://www.intel.com/', priceLabel: '$30', priceMin: 30, priceMax: 30, features: ['Standard Intel case'] },
  { chassisSlug: 's-cloud', title: '3D Print Compact', optionType: 'printable', sourceName: 'Thingiverse #7012345', sourceUrl: 'https://www.thingiverse.com/thing:7012345', priceLabel: '$10-25', priceMin: 10, priceMax: 25, features: ['Minimal', 'NUC-sized'] },
  { chassisSlug: 's-cloud', title: '3D Print VESA Mount', optionType: 'printable', sourceName: 'Thingiverse #7023456', sourceUrl: 'https://www.thingiverse.com/thing:7023456', priceLabel: '$15-30', priceMin: 15, priceMax: 30, features: ['Mount behind monitor'] },
  { chassisSlug: 's-nas', title: 'SilverStone CS01-HS', optionType: 'commercial', vendor: 'SilverStone', sourceName: 'silverstonetek.com', sourceUrl: 'https://www.silverstonetek.com/', priceLabel: '$80', priceMin: 80, priceMax: 80, features: ['4-bay', 'Hot-swap'] },
  { chassisSlug: 's-nas', title: 'Jonsbo N1', optionType: 'commercial', vendor: 'Jonsbo', sourceName: 'jonsbo.com', sourceUrl: 'https://www.jonsbo.com/', priceLabel: '$90', priceMin: 90, priceMax: 90, features: ['5-bay', 'Compact ITX'], isRecommended: true },
  { chassisSlug: 's-nas', title: 'Fractal Node 304', optionType: 'commercial', vendor: 'Fractal', sourceName: 'fractal-design.com', sourceUrl: 'https://www.fractal-design.com/', priceLabel: '$100', priceMin: 100, priceMax: 100, features: ['6-bay', 'Mini-ITX'], isRecommended: true },
  { chassisSlug: 's-nas', title: '3D Print External Bay', optionType: 'printable', sourceName: 'Thingiverse #7112345', sourceUrl: 'https://www.thingiverse.com/thing:7112345', priceLabel: '$15-35', priceMin: 15, priceMax: 35, features: ['External drive holder'] },
  { chassisSlug: 's-nas', title: '3D Print Compact NAS', optionType: 'printable', sourceName: 'Thingiverse #7123456', sourceUrl: 'https://www.thingiverse.com/thing:7123456', priceLabel: '$20-45', priceMin: 20, priceMax: 45, features: ['All-in-one enclosure'] },
  { chassisSlug: 'm-cloud', title: 'Fractal Node 202', optionType: 'commercial', vendor: 'Fractal', sourceName: 'fractal-design.com', sourceUrl: 'https://www.fractal-design.com/', priceLabel: '$80', priceMin: 80, priceMax: 80, features: ['Console-style', 'Slim'], isRecommended: true },
  { chassisSlug: 'm-cloud', title: 'SilverStone ML08', optionType: 'commercial', vendor: 'SilverStone', sourceName: 'silverstonetek.com', sourceUrl: 'https://www.silverstonetek.com/', priceLabel: '$70', priceMin: 70, priceMax: 70, features: ['Slim', 'Handle included'] },
  { chassisSlug: 'm-cloud', title: 'InWin Chopin', optionType: 'commercial', vendor: 'InWin', sourceName: 'in-win.com', sourceUrl: 'https://www.in-win.com/', priceLabel: '$85', priceMin: 85, priceMax: 85, features: ['Compact', 'PSU included'], isRecommended: true },
  { chassisSlug: 'm-cloud', title: 'NZXT H1', optionType: 'commercial', vendor: 'NZXT', sourceName: 'nzxt.com', sourceUrl: 'https://nzxt.com/', priceLabel: '$200', priceMin: 200, priceMax: 200, features: ['Vertical', 'PSU+AIO included'] },
  { chassisSlug: 'm-cloud', title: '3D Print Console', optionType: 'printable', sourceName: 'Thingiverse #8012345', sourceUrl: 'https://www.thingiverse.com/thing:8012345', priceLabel: '$25-50', priceMin: 25, priceMax: 50, features: ['Horizontal console style'] },
  { chassisSlug: 'm-cloud', title: '3D Print Vertical', optionType: 'printable', sourceName: 'Thingiverse #8023456', sourceUrl: 'https://www.thingiverse.com/thing:8023456', priceLabel: '$30-60', priceMin: 30, priceMax: 60, features: ['Tower style', 'Small footprint'] },
  { chassisSlug: 'm-nas', title: 'Fractal Node 304', optionType: 'commercial', vendor: 'Fractal', sourceName: 'fractal-design.com', sourceUrl: 'https://www.fractal-design.com/', priceLabel: '$100', priceMin: 100, priceMax: 100, features: ['6-bay', 'Mini-ITX'], isRecommended: true },
  { chassisSlug: 'm-nas', title: 'Jonsbo N2', optionType: 'commercial', vendor: 'Jonsbo', sourceName: 'jonsbo.com', sourceUrl: 'https://www.jonsbo.com/', priceLabel: '$110', priceMin: 110, priceMax: 110, features: ['5-bay', 'NAS-focused'], isRecommended: true },
  { chassisSlug: 'm-nas', title: 'SilverStone CS351', optionType: 'commercial', vendor: 'SilverStone', sourceName: 'silverstonetek.com', sourceUrl: 'https://www.silverstonetek.com/', priceLabel: '$120', priceMin: 120, priceMax: 120, features: ['8-bay', 'Hot-swap'] },
  { chassisSlug: 'm-nas', title: '3D Print Multi-bay', optionType: 'printable', sourceName: 'Thingiverse #8112345', sourceUrl: 'https://www.thingiverse.com/thing:8112345', priceLabel: '$30-70', priceMin: 30, priceMax: 70, features: ['Custom drive count'] },
  { chassisSlug: 'm-nas', title: '3D Print Horizontal', optionType: 'printable', sourceName: 'Thingiverse #8123456', sourceUrl: 'https://www.thingiverse.com/thing:8123456', priceLabel: '$25-55', priceMin: 25, priceMax: 55, features: ['Low-profile NAS'] },
  { chassisSlug: 'l-cloud', title: 'Fractal Define R5', optionType: 'commercial', vendor: 'Fractal', sourceName: 'fractal-design.com', sourceUrl: 'https://www.fractal-design.com/', priceLabel: '$130', priceMin: 130, priceMax: 130, features: ['Silent', 'Classic'], isRecommended: true },
  { chassisSlug: 'l-cloud', title: 'NZXT H510', optionType: 'commercial', vendor: 'NZXT', sourceName: 'nzxt.com', sourceUrl: 'https://nzxt.com/', priceLabel: '$85', priceMin: 85, priceMax: 85, features: ['Clean', 'Windowed'], isRecommended: true },
  { chassisSlug: 'l-cloud', title: 'Phanteks P400A', optionType: 'commercial', vendor: 'Phanteks', sourceName: 'phanteks.com', sourceUrl: 'https://phanteks.com/', priceLabel: '$100', priceMin: 100, priceMax: 100, features: ['Mesh front', 'Good airflow'] },
  { chassisSlug: 'l-cloud', title: 'be quiet! Pure Base 500', optionType: 'commercial', vendor: 'be quiet!', sourceName: 'bequiet.com', sourceUrl: 'https://www.bequiet.com/', priceLabel: '$90', priceMin: 90, priceMax: 90, features: ['Silent', 'Minimalist'] },
  { chassisSlug: 'l-cloud', title: '3D Print Tower', optionType: 'printable', sourceName: 'Thingiverse #9012345', sourceUrl: 'https://www.thingiverse.com/thing:9012345', priceLabel: '$40-100', priceMin: 40, priceMax: 100, features: ['Custom design'] },
  { chassisSlug: 'l-cloud', title: '3D Print Windowed', optionType: 'printable', sourceName: 'Thingiverse #9023456', sourceUrl: 'https://www.thingiverse.com/thing:9023456', priceLabel: '$50-120', priceMin: 50, priceMax: 120, features: ['Acrylic side panel'] },
  { chassisSlug: 'l-nas', title: 'Fractal Define 7', optionType: 'commercial', vendor: 'Fractal', sourceName: 'fractal-design.com', sourceUrl: 'https://www.fractal-design.com/', priceLabel: '$170', priceMin: 170, priceMax: 170, features: ['14-bay', 'Modular'], isRecommended: true },
  { chassisSlug: 'l-nas', title: 'SilverStone CS380', optionType: 'commercial', vendor: 'SilverStone', sourceName: 'silverstonetek.com', sourceUrl: 'https://www.silverstonetek.com/', priceLabel: '$150', priceMin: 150, priceMax: 150, features: ['8-bay', 'Hot-swap'], isRecommended: true },
  { chassisSlug: 'l-nas', title: 'Phanteks Enthoo Pro 2', optionType: 'commercial', vendor: 'Phanteks', sourceName: 'phanteks.com', sourceUrl: 'https://phanteks.com/', priceLabel: '$140', priceMin: 140, priceMax: 140, features: ['12-bay', 'Full tower'] },
  { chassisSlug: 'l-nas', title: '3D Print Drive Cage', optionType: 'printable', sourceName: 'Thingiverse #9112345', sourceUrl: 'https://www.thingiverse.com/thing:9112345', priceLabel: '$60-150', priceMin: 60, priceMax: 150, features: ['Custom drive cages'] },
  { chassisSlug: 'l-nas', title: '3D Print Server Style', optionType: 'printable', sourceName: 'Thingiverse #9123456', sourceUrl: 'https://www.thingiverse.com/thing:9123456', priceLabel: '$70-180', priceMin: 70, priceMax: 180, features: ['Rack-style design'] },
];

export const PART_SEED: SeedPart[] = [
  { slug: 'xs-pi5-8gb', category: 'cpu', vendor: 'Raspberry Pi', name: 'Raspberry Pi 5 8GB', description: 'Integrated ARM SoC board for XS cloud and dev builds.', basePrice: 80, sellingPrice: 80, specs: { cores: 4, frequency: '2.4 GHz ARM', architecture: 'ARM64' }, compatibleChassisSlugs: ['xs-cloud', 'xs-dev', 'xs-nas'] },
  { slug: 'xs-ram-8gb-onboard', category: 'ram', vendor: 'Raspberry Pi', name: '8GB LPDDR4X Onboard', description: 'Integrated memory for Raspberry Pi 5 8GB boards.', basePrice: 0, sellingPrice: 0, specs: { capacity: '8GB', speed: 'LPDDR4X' }, compatibleChassisSlugs: ['xs-cloud', 'xs-dev', 'xs-nas'] },
  { slug: 'xs-storage-256-nvme', category: 'storage', vendor: 'Generic', name: '256GB NVMe for Pi HAT+', description: 'Compact NVMe storage for Pi enclosures with HAT+ support.', basePrice: 35, sellingPrice: 35, specs: { capacity: '256GB', type: 'NVMe SSD' }, compatibleChassisSlugs: ['xs-cloud', 'xs-dev'] },
  { slug: 'xs-storage-2tb-usb', category: 'storage', vendor: 'Generic', name: '2TB USB Archive SSD', description: 'External SSD profile for Pi NAS and archive builds.', basePrice: 120, sellingPrice: 120, specs: { capacity: '2TB', type: 'USB SSD' }, compatibleChassisSlugs: ['xs-nas'] },
  { slug: 'xs-gpu-none', category: 'gpu', vendor: 'Raspberry Pi', name: 'Integrated VideoCore', description: 'No discrete GPU in XS Pi builds.', basePrice: 0, sellingPrice: 0, specs: { vram: 'Shared' }, compatibleChassisSlugs: ['xs-cloud', 'xs-dev', 'xs-nas'] },
  { slug: 's-cpu-n100', category: 'cpu', vendor: 'Intel', name: 'Intel Processor N100', description: 'Low-power CPU profile for compact S cloud builds.', basePrice: 120, sellingPrice: 120, specs: { cores: 4, frequency: '3.4 GHz turbo' }, compatibleChassisSlugs: ['s-cloud'] },
  { slug: 's-cpu-i5-14500t', category: 'cpu', vendor: 'Intel', name: 'Intel Core i5-14500T', description: 'Efficient S-tier CPU option for compact systems.', basePrice: 245, sellingPrice: 245, specs: { cores: 14, frequency: '1.7 GHz base' }, compatibleChassisSlugs: ['s-cloud', 's-nas'] },
  { slug: 's-ram-32-ddr5', category: 'ram', vendor: 'Crucial', name: '32GB DDR5 SODIMM Kit', description: 'Compact memory kit for S-tier systems.', basePrice: 115, sellingPrice: 115, specs: { capacity: '32GB', speed: 'DDR5-5600' }, compatibleChassisSlugs: ['s-cloud', 's-nas'] },
  { slug: 's-storage-2tb-nvme', category: 'storage', vendor: 'Samsung', name: '2TB NVMe Compact', description: 'Primary storage for S-tier compact systems.', basePrice: 160, sellingPrice: 160, specs: { capacity: '2TB', type: 'NVMe SSD' }, compatibleChassisSlugs: ['s-cloud', 's-nas'] },
  { slug: 's-storage-8tb-sata', category: 'storage', vendor: 'Seagate', name: '8TB NAS HDD', description: 'Compact NAS storage option.', basePrice: 175, sellingPrice: 175, specs: { capacity: '8TB', type: 'SATA HDD' }, compatibleChassisSlugs: ['s-nas'] },
  { slug: 's-gpu-none', category: 'gpu', vendor: 'Intel', name: 'Integrated Graphics', description: 'No discrete GPU in default S builds.', basePrice: 0, sellingPrice: 0, specs: { vram: 'Shared' }, compatibleChassisSlugs: ['s-cloud', 's-nas'] },
  { slug: 'm-cpu-ryzen-7700', category: 'cpu', vendor: 'AMD', name: 'AMD Ryzen 7 7700', description: 'Balanced compute CPU for M-tier builds.', basePrice: 289, sellingPrice: 289, specs: { cores: 8, frequency: '3.8 GHz base' }, compatibleChassisSlugs: ['m-cloud', 'm-nas'] },
  { slug: 'm-ram-64-ddr5', category: 'ram', vendor: 'Crucial', name: '64GB DDR5 ECC', description: 'High-capacity memory for M-tier systems.', basePrice: 289, sellingPrice: 289, specs: { capacity: '64GB', speed: 'DDR5-5600' }, compatibleChassisSlugs: ['m-cloud', 'm-nas'] },
  { slug: 'm-storage-2tb-nvme', category: 'storage', vendor: 'Samsung', name: '2TB NVMe Primary', description: 'Fast primary storage for M-tier builds.', basePrice: 179, sellingPrice: 179, specs: { capacity: '2TB', type: 'NVMe SSD' }, compatibleChassisSlugs: ['m-cloud', 'm-nas'] },
  { slug: 'm-storage-8tb-sata', category: 'storage', vendor: 'Seagate', name: '8TB Archive Drive', description: 'Large-capacity storage for M NAS builds.', basePrice: 199, sellingPrice: 199, specs: { capacity: '8TB', type: 'SATA HDD' }, compatibleChassisSlugs: ['m-nas'] },
  { slug: 'm-gpu-l4', category: 'gpu', vendor: 'NVIDIA', name: 'NVIDIA L4', description: 'Low-profile accelerator for M cloud builds.', basePrice: 2299, sellingPrice: 2299, specs: { vram: '24GB' }, compatibleChassisSlugs: ['m-cloud'] },
  { slug: 'l-cpu-9950x', category: 'cpu', vendor: 'AMD', name: 'AMD Ryzen 9 9950X', description: 'High-end tower CPU for L-tier compute.', basePrice: 649, sellingPrice: 649, specs: { cores: 16, frequency: '4.3 GHz base' }, compatibleChassisSlugs: ['l-cloud', 'l-nas'] },
  { slug: 'l-ram-128-ddr5', category: 'ram', vendor: 'Kingston', name: '128GB DDR5 Kit', description: 'Large tower memory kit for compute and archive nodes.', basePrice: 499, sellingPrice: 499, specs: { capacity: '128GB', speed: 'DDR5-5600' }, compatibleChassisSlugs: ['l-cloud', 'l-nas'] },
  { slug: 'l-storage-4tb-nvme', category: 'storage', vendor: 'Samsung', name: '4TB NVMe Primary', description: 'Primary storage for L cloud systems.', basePrice: 299, sellingPrice: 299, specs: { capacity: '4TB', type: 'NVMe SSD' }, compatibleChassisSlugs: ['l-cloud', 'l-nas'] },
  { slug: 'l-storage-16tb-hdd', category: 'storage', vendor: 'Seagate', name: '16TB NAS HDD', description: 'High-capacity spinning disk for archive builds.', basePrice: 289, sellingPrice: 289, specs: { capacity: '16TB', type: 'SATA HDD' }, compatibleChassisSlugs: ['l-nas'] },
  { slug: 'l-gpu-rtx-4080-super', category: 'gpu', vendor: 'NVIDIA', name: 'GeForce RTX 4080 SUPER', description: 'High-end accelerator for L-tier compute and rendering.', basePrice: 999, sellingPrice: 999, specs: { vram: '16GB' }, compatibleChassisSlugs: ['l-cloud'] },
];

export const PCPARTPICKER_CATEGORY_URLS = {
  cpu: 'https://pcpartpicker.com/products/cpu/',
  ram: 'https://pcpartpicker.com/products/memory/',
  storage: 'https://pcpartpicker.com/products/internal-hard-drive/',
  gpu: 'https://pcpartpicker.com/products/video-card/',
};
