/**
 * SHA-256 pins for the Census TIGER2026 archives the automatic geometry sweep may use. A downloaded archive that does
 * not match its pin is refused; a state without a pin is never fetched and its towns go to review instead. The values
 * come from the S2 local Census preparation (S2-local-census-preparation-2026-11-09.md). They bind the exact bytes;
 * they are not independent signatures.
 */
export const CENSUS_TIGER_VINTAGE = '2026';
export const CENSUS_TIGER_ORIGIN = 'https://www2.census.gov';

export interface CensusArchivePins {
  place: string;
  cousub: string;
}

export const CENSUS_TIGER_PINS: Readonly<Record<string, CensusArchivePins>> =
  Object.freeze({
    '01': {
      place: 'b47351eb605640dc81ab7fa569be9a0d9e0500fc51d58f26230586805c8f6219',
      cousub:
        '897c5d09907783e528bfa31162fe775c00da58d49bba298872390e7287b3a246',
    }, // AL
    '09': {
      place: '83308c4da971082ea3a90a1abd73c1bd682024c4d908668dac97785ea7a90265',
      cousub:
        '12a8d846e1021257e9834ad57deb8aa4fef25e0e74b4f1932e3e6c35546ad7df',
    }, // CT
    '11': {
      place: '0e1651467acd633ff76ad46c151002f8420d44731f7d8cd6e58e1a1efb426fc0',
      cousub:
        '24150fd905c71066710890b48c273b656e9217da7c98c49b086074039f0bc1ae',
    }, // DC
    '10': {
      place: 'edd5dce77c578d799e251ca445943bd3e07c2e142f776cfaa1438c12d4186473',
      cousub:
        '98bd9405e3bb0d6018cb3fbead2bfe3b24b8ef0e5ebdde6b4caee6b84881af0c',
    }, // DE
    '12': {
      place: '38a86feeb17300f9991d5c89b5fb1d61c42823cc4bacb1f7f0738605a22ed8ec',
      cousub:
        'f57a925111581347c04b9eddc0710760f315e3831ab2c0550acd09f9ae963f6c',
    }, // FL
    '13': {
      place: '1325e424664f8c0f517c0aa155e3806ca299785ccca4e1badc9fe4f3f4173e09',
      cousub:
        '69fd8066866bda0bc720a03743f6110ad9a75fb53dacc0d38066ac587676f3a4',
    }, // GA
    '25': {
      place: '875091e775ef79569299b69a448e57d9f8fe606ac5d49285722b34648b073b7c',
      cousub:
        '63b555399664894bba33ea76786d99ed913f3ade84ae24b67cc83080c2d4179c',
    }, // MA
    '24': {
      place: '55fe4f40bfed7141fe9a683354918e26813833abf4d9602cf9c938b852c55c30',
      cousub:
        '757e6cc48576346646fe26997f283f4eaae11c0f530a160849c5fc8146e438d3',
    }, // MD
    '37': {
      place: 'd309e8969e5535c3c66245fdd2ba194af9210128e4ab6e0716ec238bfb180328',
      cousub:
        '0e5731d475ac8dc0fa8933972e0c25c2567c3534588844976c5d1a50bf8c7d03',
    }, // NC
    '34': {
      place: '03457086b4e4d957d2a445a56164dc256308845a6e0d4f84181238881b7e42ed',
      cousub:
        'e83b45c07a423a1c7bf4a901f33e45a6048183542240fd020d0ad524ab4aa64d',
    }, // NJ
    '36': {
      place: '4a78264f9d15d6b827ed48f18242074d35836873d63a0c05f18af85c28f8a564',
      cousub:
        '3da54034416870f669ffdbc8f0329a71412956a715096448f47e0e56a51da46b',
    }, // NY
    '42': {
      place: '08216e494fd68baf6e3147598d8874681ba06138a15a29ce87c9afd596b3d633',
      cousub:
        'e16e672a187684607883cb8d358ee4adc992bfabb93ce68637becb53fd7e878d',
    }, // PA
    '44': {
      place: '00770983a913c0858b356da42897dbf3a32c4d4db086b53a18fe451e2e3b2c42',
      cousub:
        'e546ad6394ae034024a5d5980dc1513d37d61f68bdd0117ada468d50de08c5ce',
    }, // RI
    '45': {
      place: '6311fd1255b1658f6f06de096840c6f121530d8922c63eadc035f55a49b6a579',
      cousub:
        'c9470c02f3a6e81166e73f03cc022d34c4cc6c48188d56b6857f0a8d26482083',
    }, // SC
    '48': {
      place: 'd6bbad505fd9b6b2e2c35512d05bf30858dfdfdf3dabf037537e28f0fbbc5269',
      cousub:
        '85c0ca8140b554012eaf1d46be8fef94aa6cda9abc3100ff8c1e584ca2909d7a',
    }, // TX
    '51': {
      place: 'ef4b56daff25a287e57583c4c24e934a25ba7e3430f25defbe21c13754883a40',
      cousub:
        'a727d775d94aa315f6cf16c347bcbb022d884cadb0a6a866523b6e47fda09a8b',
    }, // VA
    '54': {
      place: '6b8f78aaefb47b1bf0cb64abdaebb99be62c99b7c55a6a29ef79c02e2505d5d8',
      cousub:
        '5b04eeacc14f4ecba97a99d99abb713e938cf001b1e8df3a370d302d678129fb',
    }, // WV
  });

export function censusArchiveUrl(
  stateFips: string,
  layer: 'place' | 'cousub',
  vintage: string = CENSUS_TIGER_VINTAGE
): string {
  return `${CENSUS_TIGER_ORIGIN}/geo/tiger/TIGER${vintage}/${layer.toUpperCase()}/tl_${vintage}_${stateFips}_${layer}.zip`;
}
