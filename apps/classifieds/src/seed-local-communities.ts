import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LocalCommunityEntity } from './app/entities/local-community.entity';

// ─────────────────────────────────────────────────────────────────────────────
// 54 localities within 250 miles of ZIP 31406 (Savannah, GA: 31.9868,-81.0982)
// with a population of at least 10,000 people.
//
// Haversine distances were computed from origin (31.9868, -81.0982).
// Data: US Census Bureau / Wikipedia population estimates.
// ─────────────────────────────────────────────────────────────────────────────

type Locality = {
  name: string;
  slug: string;
  description: string;
  localityType: 'city' | 'town' | 'neighborhood' | 'county' | 'region';
  countryCode: string;
  adminArea: string;
  city: string;
  lat: number;
  lng: number;
  population: number;
};

const COMMUNITIES: Locality[] = [
  // ── Georgia ──────────────────────────────────────────────────────────────
  {
    name: 'Savannah, GA',
    slug: 'savannah-ga',
    description: 'Georgia\'s oldest city, known for its stunning squares, antebellum architecture, and vibrant arts scene along the Savannah River.',
    localityType: 'city', countryCode: 'US', adminArea: 'GA', city: 'Savannah',
    lat: 31.9868, lng: -81.0982, population: 147780,
  },
  {
    name: 'Hilton Head Island, SC',
    slug: 'hilton-head-island-sc',
    description: 'A world-class resort island famous for its pristine beaches, championship golf, and outdoor recreation along the Atlantic coast.',
    localityType: 'city', countryCode: 'US', adminArea: 'SC', city: 'Hilton Head Island',
    lat: 32.2163, lng: -80.7526, population: 39945,
  },
  {
    name: 'Hinesville, GA',
    slug: 'hinesville-ga',
    description: 'Home to Fort Stewart, one of the largest Army installations in the US, with a strong military community and growing civilian population.',
    localityType: 'city', countryCode: 'US', adminArea: 'GA', city: 'Hinesville',
    lat: 31.8468, lng: -81.5957, population: 33703,
  },
  {
    name: 'Beaufort, SC',
    slug: 'beaufort-sc',
    description: 'A charming Lowcountry city with antebellum architecture, Gullah culture, and beautiful waterways connecting the Sea Islands.',
    localityType: 'city', countryCode: 'US', adminArea: 'SC', city: 'Beaufort',
    lat: 32.4316, lng: -80.6698, population: 14025,
  },
  {
    name: 'Statesboro, GA',
    slug: 'statesboro-ga',
    description: 'Home to Georgia Southern University, offering college-town energy with a vibrant downtown and surrounding agricultural heritage.',
    localityType: 'city', countryCode: 'US', adminArea: 'GA', city: 'Statesboro',
    lat: 32.4488, lng: -81.7832, population: 33736,
  },
  {
    name: 'Jesup, GA',
    slug: 'jesup-ga',
    description: 'A welcoming Southeast Georgia community known as the Carpet Capital of the World, with deep ties to the timber and agriculture industries.',
    localityType: 'city', countryCode: 'US', adminArea: 'GA', city: 'Jesup',
    lat: 31.5983, lng: -81.8857, population: 10214,
  },
  {
    name: 'Brunswick, GA',
    slug: 'brunswick-ga',
    description: 'The Golden Isles gateway city with historic Old Town, fresh seafood, and access to Jekyll Island, St. Simons, and Sea Island.',
    localityType: 'city', countryCode: 'US', adminArea: 'GA', city: 'Brunswick',
    lat: 31.1499, lng: -81.4915, population: 21875,
  },
  {
    name: 'Vidalia, GA',
    slug: 'vidalia-ga',
    description: 'Famous for its sweet Vidalia onions, this Southeast Georgia town celebrates its agriculture and small-town hospitality.',
    localityType: 'city', countryCode: 'US', adminArea: 'GA', city: 'Vidalia',
    lat: 32.2177, lng: -82.4132, population: 11024,
  },
  {
    name: 'Charleston, SC',
    slug: 'charleston-sc',
    description: 'One of America\'s most beloved historic cities, with cobblestone streets, antebellum plantations, world-class dining, and a rich cultural tapestry.',
    localityType: 'city', countryCode: 'US', adminArea: 'SC', city: 'Charleston',
    lat: 32.7767, lng: -79.9311, population: 150277,
  },
  {
    name: 'Waycross, GA',
    slug: 'waycross-ga',
    description: 'Gateway to the Okefenokee Swamp, one of the largest blackwater wetland preserves in North America, with outdoor adventures and railroad history.',
    localityType: 'city', countryCode: 'US', adminArea: 'GA', city: 'Waycross',
    lat: 31.2135, lng: -82.3549, population: 14163,
  },
  {
    name: 'Fernandina Beach, FL',
    slug: 'fernandina-beach-fl',
    description: 'Historic Amelia Island city with Victorian architecture, a charming downtown historic district, and beautiful Atlantic beaches.',
    localityType: 'city', countryCode: 'US', adminArea: 'FL', city: 'Fernandina Beach',
    lat: 30.6696, lng: -81.4626, population: 12969,
  },
  {
    name: 'Orangeburg, SC',
    slug: 'orangeburg-sc',
    description: 'Home to South Carolina State University and Claflin University, with a vibrant community spirit and regional festival scene.',
    localityType: 'city', countryCode: 'US', adminArea: 'SC', city: 'Orangeburg',
    lat: 33.4918, lng: -80.8548, population: 13964,
  },
  {
    name: 'Douglas, GA',
    slug: 'douglas-ga',
    description: 'The seat of Coffee County, a growing South Georgia community with strong agricultural roots and emerging manufacturing.',
    localityType: 'city', countryCode: 'US', adminArea: 'GA', city: 'Douglas',
    lat: 31.5088, lng: -82.8499, population: 11589,
  },
  {
    name: 'Dublin, GA',
    slug: 'dublin-ga',
    description: 'The "Emerald City" of Georgia, known for its annual St. Patrick\'s Festival, thriving business community, and Oconee River setting.',
    localityType: 'city', countryCode: 'US', adminArea: 'GA', city: 'Dublin',
    lat: 32.5402, lng: -82.9038, population: 15938,
  },
  {
    name: 'Aiken, SC',
    slug: 'aiken-sc',
    description: 'A charming horse-country city known for its equestrian culture, beautiful historic district, and proximity to the CSRA region.',
    localityType: 'city', countryCode: 'US', adminArea: 'SC', city: 'Aiken',
    lat: 33.5601, lng: -81.7198, population: 30987,
  },
  {
    name: 'Augusta, GA',
    slug: 'augusta-ga',
    description: 'Georgia\'s second-largest city, home to The Masters golf tournament, a revitalized Riverwalk, and a growing cyber and medical corridor.',
    localityType: 'city', countryCode: 'US', adminArea: 'GA', city: 'Augusta',
    lat: 33.4735, lng: -82.0105, population: 202081,
  },
  {
    name: 'Jacksonville, FL',
    slug: 'jacksonville-fl',
    description: 'Florida\'s largest city by area, with expansive beaches, the St. Johns River, a growing tech scene, and diverse neighborhoods.',
    localityType: 'city', countryCode: 'US', adminArea: 'FL', city: 'Jacksonville',
    lat: 30.3322, lng: -81.6557, population: 949611,
  },
  {
    name: 'Columbia, SC',
    slug: 'columbia-sc',
    description: 'South Carolina\'s capital city and home to the University of South Carolina, with a vibrant arts scene, historic Five Points, and the Vista district.',
    localityType: 'city', countryCode: 'US', adminArea: 'SC', city: 'Columbia',
    lat: 34.0007, lng: -81.0348, population: 136632,
  },
  {
    name: 'Sumter, SC',
    slug: 'sumter-sc',
    description: 'Known as the Iris Capital of the World, this Central South Carolina city hosts Shaw Air Force Base and a welcoming community spirit.',
    localityType: 'city', countryCode: 'US', adminArea: 'SC', city: 'Sumter',
    lat: 33.9204, lng: -80.3412, population: 41190,
  },
  {
    name: 'Georgetown, SC',
    slug: 'georgetown-sc',
    description: 'South Carolina\'s third-oldest city, with a beautifully preserved historic district, waterfront downtown, and rich Gullah-Geechee heritage.',
    localityType: 'city', countryCode: 'US', adminArea: 'SC', city: 'Georgetown',
    lat: 33.3765, lng: -79.2945, population: 10153,
  },
  {
    name: 'Milledgeville, GA',
    slug: 'milledgeville-ga',
    description: 'Georgia\'s antebellum capital city, home to Georgia College & State University and the legacy of author Flannery O\'Connor.',
    localityType: 'city', countryCode: 'US', adminArea: 'GA', city: 'Milledgeville',
    lat: 33.0801, lng: -83.2321, population: 18453,
  },
  {
    name: 'Tifton, GA',
    slug: 'tifton-ga',
    description: 'South Georgia\'s agricultural hub, known as the "Friendly City," with a strong farming heritage and growing industrial base on I-75.',
    localityType: 'city', countryCode: 'US', adminArea: 'GA', city: 'Tifton',
    lat: 31.4499, lng: -83.5085, population: 20060,
  },
  {
    name: 'St. Augustine, FL',
    slug: 'st-augustine-fl',
    description: 'The oldest continuously occupied European settlement in the US, with centuries of history, stunning Spanish colonial architecture, and beautiful beaches.',
    localityType: 'city', countryCode: 'US', adminArea: 'FL', city: 'St. Augustine',
    lat: 29.8947, lng: -81.5150, population: 14399,
  },
  {
    name: 'Valdosta, GA',
    slug: 'valdosta-ga',
    description: 'The "Azalea City" of Georgia, home to Valdosta State University, with a vibrant downtown and a key position on I-75 near the Florida border.',
    localityType: 'city', countryCode: 'US', adminArea: 'GA', city: 'Valdosta',
    lat: 30.8327, lng: -83.2785, population: 56436,
  },
  {
    name: 'Warner Robins, GA',
    slug: 'warner-robins-ga',
    description: 'Central Georgia\'s fastest-growing city, home to Robins Air Force Base and the Museum of Aviation, the second-largest air museum in the US.',
    localityType: 'city', countryCode: 'US', adminArea: 'GA', city: 'Warner Robins',
    lat: 32.6130, lng: -83.5996, population: 80308,
  },
  {
    name: 'Lake City, FL',
    slug: 'lake-city-fl',
    description: 'Northern Florida\'s Gateway City, sitting at the crossroads of I-75 and I-10 with natural springs, parks, and outdoor recreation.',
    localityType: 'city', countryCode: 'US', adminArea: 'FL', city: 'Lake City',
    lat: 30.1897, lng: -82.6390, population: 12926,
  },
  {
    name: 'Cordele, GA',
    slug: 'cordele-ga',
    description: 'The "Watermelon Capital of the World," a small South Georgia town with Georgia Veterans State Park and a warm small-town character.',
    localityType: 'city', countryCode: 'US', adminArea: 'GA', city: 'Cordele',
    lat: 31.9632, lng: -83.7807, population: 11608,
  },
  {
    name: 'Macon, GA',
    slug: 'macon-ga',
    description: 'The "Cherry Blossom City" of Georgia, birthplace of the Allman Brothers Band, with stunning antebellum architecture and a thriving arts scene.',
    localityType: 'city', countryCode: 'US', adminArea: 'GA', city: 'Macon',
    lat: 32.8407, lng: -83.6324, population: 157346,
  },
  {
    name: 'Palatka, FL',
    slug: 'palatka-fl',
    description: 'A historic St. Johns River city in Putnam County, known as the "Bass Capital of the World," with beautiful river views and a growing arts community.',
    localityType: 'city', countryCode: 'US', adminArea: 'FL', city: 'Palatka',
    lat: 29.6486, lng: -81.6376, population: 10558,
  },
  {
    name: 'Moultrie, GA',
    slug: 'moultrie-ga',
    description: 'Colquitt County\'s seat in Southwest Georgia, known for its historic downtown, agricultural heritage, and the remarkable Birdsong Nature Center nearby.',
    localityType: 'city', countryCode: 'US', adminArea: 'GA', city: 'Moultrie',
    lat: 31.1797, lng: -83.7888, population: 14268,
  },
  {
    name: 'Florence, SC',
    slug: 'florence-sc',
    description: 'The Pee Dee region\'s economic hub with the Francis Marion University, McLeod Health system, and a growing retail and restaurant scene.',
    localityType: 'city', countryCode: 'US', adminArea: 'SC', city: 'Florence',
    lat: 34.1954, lng: -79.7626, population: 38501,
  },
  {
    name: 'Myrtle Beach, SC',
    slug: 'myrtle-beach-sc',
    description: 'The Grand Strand\'s entertainment capital with 60 miles of beautiful beaches, world-class golf, and a lively boardwalk scene.',
    localityType: 'city', countryCode: 'US', adminArea: 'SC', city: 'Myrtle Beach',
    lat: 33.6891, lng: -78.8867, population: 35682,
  },
  {
    name: 'Conway, SC',
    slug: 'conway-sc',
    description: 'Horry County\'s charming seat on the Waccamaw River, with a scenic riverwalk, historic downtown, and the vibrant Coastal Carolina University community.',
    localityType: 'city', countryCode: 'US', adminArea: 'SC', city: 'Conway',
    lat: 33.8360, lng: -79.0468, population: 24849,
  },
  {
    name: 'Gainesville, FL',
    slug: 'gainesville-fl',
    description: 'Home to the University of Florida, with a dynamic college-town culture, thriving arts scene, natural springs, and one of Florida\'s most livable downtowns.',
    localityType: 'city', countryCode: 'US', adminArea: 'FL', city: 'Gainesville',
    lat: 29.6516, lng: -82.3248, population: 134094,
  },
  {
    name: 'Albany, GA',
    slug: 'albany-ga',
    description: 'Southwest Georgia\'s largest city on the Flint River, home to Darton State College, the Ray Charles birthplace, and a revitalized downtown.',
    localityType: 'city', countryCode: 'US', adminArea: 'GA', city: 'Albany',
    lat: 31.5785, lng: -84.1557, population: 71473,
  },
  {
    name: 'Americus, GA',
    slug: 'americus-ga',
    description: 'Home of Georgia Southwestern State University and Habitat for Humanity International, a community with deep civic roots in Sumter County.',
    localityType: 'city', countryCode: 'US', adminArea: 'GA', city: 'Americus',
    lat: 32.0724, lng: -84.2327, population: 15756,
  },
  {
    name: 'Thomasville, GA',
    slug: 'thomasville-ga',
    description: 'The "City of Roses," a Victorian jewel in Southwest Georgia known for its annual Rose Show, antique district, and grand plantation traditions.',
    localityType: 'city', countryCode: 'US', adminArea: 'GA', city: 'Thomasville',
    lat: 30.8366, lng: -83.9788, population: 18561,
  },
  {
    name: 'Athens, GA',
    slug: 'athens-ga',
    description: 'Home of the University of Georgia, Georgia\'s Classic City is a cultural powerhouse with a legendary music scene that launched R.E.M. and the B-52s.',
    localityType: 'city', countryCode: 'US', adminArea: 'GA', city: 'Athens',
    lat: 33.9519, lng: -83.3576, population: 126913,
  },
  {
    name: 'Daytona Beach, FL',
    slug: 'daytona-beach-fl',
    description: 'The World Center of Racing, with the iconic Daytona International Speedway, beautiful Atlantic beaches, and a vibrant oceanfront boardwalk.',
    localityType: 'city', countryCode: 'US', adminArea: 'FL', city: 'Daytona Beach',
    lat: 29.2108, lng: -81.0228, population: 69754,
  },
  {
    name: 'Anderson, SC',
    slug: 'anderson-sc',
    description: 'The "Electric City" of Upstate South Carolina, one of the first US cities to have electric streetlights, with a thriving arts community and great outdoors.',
    localityType: 'city', countryCode: 'US', adminArea: 'SC', city: 'Anderson',
    lat: 34.5034, lng: -82.6501, population: 28228,
  },
  {
    name: 'Perry, FL',
    slug: 'perry-fl',
    description: 'Taylor County\'s tranquil seat, the "Forest Capital of the South," with timber heritage, unspoiled nature, and the scenic Steinhatchee River nearby.',
    localityType: 'city', countryCode: 'US', adminArea: 'FL', city: 'Perry',
    lat: 30.1177, lng: -83.5835, population: 14192,
  },
  {
    name: 'Rock Hill, SC',
    slug: 'rock-hill-sc',
    description: 'York County\'s largest city in the Charlotte metro area, with a growing tech sector, Winthrop University, and the US National Whitewater Center nearby.',
    localityType: 'city', countryCode: 'US', adminArea: 'SC', city: 'Rock Hill',
    lat: 34.9249, lng: -81.0251, population: 74372,
  },
  {
    name: 'Ocala, FL',
    slug: 'ocala-fl',
    description: 'The Horse Capital of the World, with beautiful Ocala National Forest, world-class equestrian facilities, and sparkling natural springs.',
    localityType: 'city', countryCode: 'US', adminArea: 'FL', city: 'Ocala',
    lat: 29.1872, lng: -82.1401, population: 64519,
  },
  {
    name: 'Spartanburg, SC',
    slug: 'spartanburg-sc',
    description: 'Hub City of the Upstate, a resurgent South Carolina city with a growing arts scene, BMW Manufacturing, and a vibrant downtown revival.',
    localityType: 'city', countryCode: 'US', adminArea: 'SC', city: 'Spartanburg',
    lat: 34.9496, lng: -81.9321, population: 37647,
  },
  {
    name: 'Tallahassee, FL',
    slug: 'tallahassee-fl',
    description: 'Florida\'s capital city and home to FSU and FAMU, with rolling hills, canopy roads, and a vibrant political and academic community.',
    localityType: 'city', countryCode: 'US', adminArea: 'FL', city: 'Tallahassee',
    lat: 30.4518, lng: -84.2807, population: 196169,
  },
  {
    name: 'Lumberton, NC',
    slug: 'lumberton-nc',
    description: 'The largest city in Robeson County and a proud center of Lumbee Native American culture, with a resilient community spirit on the Lumber River.',
    localityType: 'city', countryCode: 'US', adminArea: 'NC', city: 'Lumberton',
    lat: 34.6185, lng: -79.0137, population: 22048,
  },
  {
    name: 'Bainbridge, GA',
    slug: 'bainbridge-ga',
    description: 'Decatur County\'s river city on the Flint River, known for its water sports, beautiful Lake Seminole, and welcoming small-town Southern hospitality.',
    localityType: 'city', countryCode: 'US', adminArea: 'GA', city: 'Bainbridge',
    lat: 30.9046, lng: -84.5752, population: 12697,
  },
  {
    name: 'Gainesville, GA',
    slug: 'gainesville-ga',
    description: 'The Poultry Capital of the World and Hall County\'s thriving seat, at the southern tip of Lake Lanier, a gateway to Northeast Georgia\'s mountains.',
    localityType: 'city', countryCode: 'US', adminArea: 'GA', city: 'Gainesville',
    lat: 34.2979, lng: -83.8241, population: 44315,
  },
  {
    name: 'Columbus, GA',
    slug: 'columbus-ga',
    description: 'Georgia\'s second-largest metro, home to Fort Moore (formerly Fort Benning), the National Infantry Museum, and a revitalized Chattahoochee Riverwalk.',
    localityType: 'city', countryCode: 'US', adminArea: 'GA', city: 'Columbus',
    lat: 32.4600, lng: -84.9877, population: 206922,
  },
  {
    name: 'Phenix City, AL',
    slug: 'phenix-city-al',
    description: 'Russell County\'s riverfront city across the Chattahoochee from Columbus, GA, with a revitalized downtown riverfront and growing community.',
    localityType: 'city', countryCode: 'US', adminArea: 'AL', city: 'Phenix City',
    lat: 32.4699, lng: -85.0008, population: 37499,
  },
  {
    name: 'Wilmington, NC',
    slug: 'wilmington-nc',
    description: 'North Carolina\'s Port City, with a vibrant historic riverfront, award-winning beaches at Wrightsville Beach, and a booming film production industry.',
    localityType: 'city', countryCode: 'US', adminArea: 'NC', city: 'Wilmington',
    lat: 34.2257, lng: -77.9447, population: 115451,
  },
  {
    name: 'LaGrange, GA',
    slug: 'lagrange-ga',
    description: 'Troup County\'s charming seat with the largest municipal park in the nation, a thriving downtown, and Kia Motors\' first US plant.',
    localityType: 'city', countryCode: 'US', adminArea: 'GA', city: 'LaGrange',
    lat: 33.0398, lng: -85.0311, population: 30892,
  },
  {
    name: 'Fayetteville, NC',
    slug: 'fayetteville-nc',
    description: 'Home to Fort Bragg, one of the largest US military installations in the world, and a community deeply connected to America\'s military heritage.',
    localityType: 'city', countryCode: 'US', adminArea: 'NC', city: 'Fayetteville',
    lat: 35.0527, lng: -78.8784, population: 211657,
  },
  {
    name: 'Greenville, SC',
    slug: 'greenville-sc',
    description: 'One of the South\'s most celebrated downtowns, with the iconic Falls Park on the Reedy, a booming arts scene, and a vibrant culinary culture.',
    localityType: 'city', countryCode: 'US', adminArea: 'SC', city: 'Greenville',
    lat: 34.8526, lng: -82.3940, population: 70720,
  },
];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const communityRepo = app.get<Repository<LocalCommunityEntity>>(
      getRepositoryToken(LocalCommunityEntity)
    );

    console.log(`Seeding ${COMMUNITIES.length} local communities...`);
    let created = 0;
    let updated = 0;

    for (const data of COMMUNITIES) {
      const existing = await communityRepo.findOne({
        where: { slug: data.slug },
      });

      if (existing) {
        Object.assign(existing, data);
        await communityRepo.save(existing);
        updated++;
        console.log(`  Updated: ${data.name}`);
      } else {
        const community = communityRepo.create(data);
        await communityRepo.save(community);
        created++;
        console.log(`  Created: ${data.name}`);
      }
    }

    console.log(
      `\nDone. Created: ${created}, Updated: ${updated}, Total: ${COMMUNITIES.length}`
    );
    await app.close();
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    await app.close();
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
