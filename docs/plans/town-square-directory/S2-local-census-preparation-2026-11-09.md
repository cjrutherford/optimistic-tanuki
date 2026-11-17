# Local Census boundary candidate preparation — 2026-11-09

The local preparation pass read checksum-pinned 2026 Census TIGER place and county-subdivision archives for the states represented by the eligible towns. It recorded 138 candidates; all other processed towns returned pending because the source did not yield a single eligible match. Candidates are not review decisions, verified boundaries or permission to serve a boundary. The four POC town assignments remain labeled unverified.

Texas initially exceeded the 16 MiB compressed-archive limit. Its county-subdivision archive is approximately 21 MiB and expands to approximately 34 MiB, within the existing 64 MiB per-member and 128 MiB total expansion limits. The compressed cap was raised to 32 MiB; the focused Census reader suite passed and a retry completed without preparation errors.

Each archive was downloaded over HTTPS from the Census TIGER2026 PLACE or COUSUB directory. The following SHA-256 values bind candidate preparation to the exact local bytes; they are not independent signatures.

| State | Place SHA-256 | County-subdivision SHA-256 |
| --- | --- | --- |
| AL | b47351eb605640dc81ab7fa569be9a0d9e0500fc51d58f26230586805c8f6219 | 897c5d09907783e528bfa31162fe775c00da58d49bba298872390e7287b3a246 |
| CT | 83308c4da971082ea3a90a1abd73c1bd682024c4d908668dac97785ea7a90265 | 12a8d846e1021257e9834ad57deb8aa4fef25e0e74b4f1932e3e6c35546ad7df |
| DC | 0e1651467acd633ff76ad46c151002f8420d44731f7d8cd6e58e1a1efb426fc0 | 24150fd905c71066710890b48c273b656e9217da7c98c49b086074039f0bc1ae |
| DE | edd5dce77c578d799e251ca445943bd3e07c2e142f776cfaa1438c12d4186473 | 98bd9405e3bb0d6018cb3fbead2bfe3b24b8ef0e5ebdde6b4caee6b84881af0c |
| FL | 38a86feeb17300f9991d5c89b5fb1d61c42823cc4bacb1f7f0738605a22ed8ec | f57a925111581347c04b9eddc0710760f315e3831ab2c0550acd09f9ae963f6c |
| GA | 1325e424664f8c0f517c0aa155e3806ca299785ccca4e1badc9fe4f3f4173e09 | 69fd8066866bda0bc720a03743f6110ad9a75fb53dacc0d38066ac587676f3a4 |
| MA | 875091e775ef79569299b69a448e57d9f8fe606ac5d49285722b34648b073b7c | 63b555399664894bba33ea76786d99ed913f3ade84ae24b67cc83080c2d4179c |
| MD | 55fe4f40bfed7141fe9a683354918e26813833abf4d9602cf9c938b852c55c30 | 757e6cc48576346646fe26997f283f4eaae11c0f530a160849c5fc8146e438d3 |
| NC | d309e8969e5535c3c66245fdd2ba194af9210128e4ab6e0716ec238bfb180328 | 0e5731d475ac8dc0fa8933972e0c25c2567c3534588844976c5d1a50bf8c7d03 |
| NJ | 03457086b4e4d957d2a445a56164dc256308845a6e0d4f84181238881b7e42ed | e83b45c07a423a1c7bf4a901f33e45a6048183542240fd020d0ad524ab4aa64d |
| NY | 4a78264f9d15d6b827ed48f18242074d35836873d63a0c05f18af85c28f8a564 | 3da54034416870f669ffdbc8f0329a71412956a715096448f47e0e56a51da46b |
| PA | 08216e494fd68baf6e3147598d8874681ba06138a15a29ce87c9afd596b3d633 | e16e672a187684607883cb8d358ee4adc992bfabb93ce68637becb53fd7e878d |
| RI | 00770983a913c0858b356da42897dbf3a32c4d4db086b53a18fe451e2e3b2c42 | e546ad6394ae034024a5d5980dc1513d37d61f68bdd0117ada468d50de08c5ce |
| SC | 6311fd1255b1658f6f06de096840c6f121530d8922c63eadc035f55a49b6a579 | c9470c02f3a6e81166e73f03cc022d34c4cc6c48188d56b6857f0a8d26482083 |
| TX | d6bbad505fd9b6b2e2c35512d05bf30858dfdfdf3dabf037537e28f0fbbc5269 | 85c0ca8140b554012eaf1d46be8fef94aa6cda9abc3100ff8c1e584ca2909d7a |
| VA | ef4b56daff25a287e57583c4c24e934a25ba7e3430f25defbe21c13754883a40 | a727d775d94aa315f6cf16c347bcbb022d884cadb0a6a866523b6e47fda09a8b |
| WV | 6b8f78aaefb47b1bf0cb64abdaebb99be62c99b7c55a6a29ef79c02e2505d5d8 | 5b04eeacc14f4ecba97a99d99abb713e938cf001b1e8df3a370d302d678129fb |

Archive URLs follow `https://www2.census.gov/geo/tiger/TIGER2026/PLACE/tl_2026_<state-fips>_place.zip` and the equivalent `COUSUB/tl_2026_<state-fips>_cousub.zip` path. Exact candidate identities, source generations and fingerprints are stored in the local Directory database. No full boundary review or installation is claimed.
