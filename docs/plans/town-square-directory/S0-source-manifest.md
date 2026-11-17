# S0 source provenance manifest

> Read-only inventory of `/home/cjrutherford/workspace/business-directory-poc`. This records hashes and paths only; it is not authorization to transfer, import, publish, acquire, or use source data.

## Observation

- Observed UTC: `2026-11-04T15:18:36Z`
- Source branch: `feat/directory-poc-slice-1`
- Source HEAD: `9948a2371fee6051c49932bfae7dcf6e732efc0a`
- Status command: `git status --porcelain=v1 -z --untracked-files=all`
- Status counts: **187 total**; 0 staged; 107 unstaged worktree changes; 80 untracked; 0 deleted; 0 renamed; 0 staged/unstaged tracked additions.
- No deleted or renamed paths were reported. The status snapshot contained tracked modifications and untracked files; HEAD alone does not reproduce them.
- Source status matched when rechecked immediately after hashing: **True**. Status may drift after this observation.

## Hash protocol and limits

- SHA-256 hashes below were calculated from file bytes in place. File contents were not copied into this manifest.
- Complete staged diff SHA-256: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` (empty staged diff; digest is SHA-256 of empty input).
- Complete unstaged tracked diff SHA-256: `2847601db0cab78063beecccc823cf57c1e363908a5816bc5ac00b678ddae53a`.
- Diff bytes were streamed directly into SHA-256 and were **not retained**. This is explicitly **NOT a retained diff**.
- Untracked file contents are not part of `git diff`; safe code/test/documentation paths are individually hashed below, while all other untracked categories are excluded. No archive or content copying is permitted. This is an incomplete snapshot, not a reconstructable source snapshot.
- The inventory is only a provenance aid; it does not prove rights, completeness, clean content, or suitability for integration.

## Changed tracked and untracked code, tests, and documentation

Only paths classified by extension as source code, tests, UI source, or Markdown documentation are listed. Configurations, data, browser captures, and generated proof outputs are excluded. Status is the porcelain XY code (` M` means unstaged modification; `??` means untracked).

| Status | Safe relative path | SHA-256 |
|---|---|---|
| ` M` | `apps/directory-api/src/app/businesses/businesses.controller.ts` | `9e238f7dab444a55ee9789920e7236701b975c0ceabee907400cf3ddaf7ac1d5` |
| ` M` | `apps/directory-api/src/app/businesses/businesses.service.spec.ts` | `d8c99759f9935726aa42b2a7f392969cecf0972a1b1511b8451092473b66227b` |
| ` M` | `apps/directory-api/src/app/businesses/businesses.service.ts` | `eadea9b3433419ec87a59f73aed9cfd5316a3fbf72689f907a4c19d376c0294b` |
| `??` | `apps/directory-api/src/app/discovery/discovery.controller.spec.ts` | `a6c2a9c8b1787792e90fe9d568e94eabb5c64969d8d277f20d5573274bbf30e4` |
| ` M` | `apps/directory-api/src/app/discovery/discovery.controller.ts` | `21775677f06ecb44e0dd59184189120207a6e2560baefbddaa40e338b116da11` |
| ` M` | `apps/directory-api/src/app/discovery/discovery.service.spec.ts` | `8df0af6e9749c8946f3fa01efd81bc8412baa7d339a6296470679a6521b422a2` |
| ` M` | `apps/directory-api/src/app/discovery/discovery.service.ts` | `5b9c6b1283fc02ce6a6fffadd5e307ae70793446970dc8a81befab6e90899b7d` |
| `??` | `apps/directory-api/src/app/discovery/overture-full-scan-manifest.spec.ts` | `fcfe0fc45deaab83144632f6a5a79e39c378abf3081aff33a9db9ff371a71e6e` |
| `??` | `apps/directory-api/src/app/discovery/overture-full-scan-manifest.ts` | `f46ad33d5b4cea066dc4da840868b09197d01414fc29ecc82f68a81087a51ca7` |
| ` M` | `apps/directory-api/src/app/documentation.module.spec.ts` | `9f80c903ba55b7a6b6e2c02df026d8ec81feec4b4e24c89a0517570c4a246d41` |
| ` M` | `apps/directory-api/src/app/documentation.module.ts` | `05bade4bd3373d90e90ad2458ad82e7a9ac061e89c8f0425f6b719c818e3abc9` |
| ` M` | `apps/directory-api/src/app/dto/operator.dto.ts` | `fb907d961b7c29ff5a4d1aa826d0997a9e3c74744031af7294f701ec9968e8d9` |
| ` M` | `apps/directory-api/src/app/dto/public.dto.spec.ts` | `e93c9fdde368587667450189d67eebe73d338be3c4f22c0c1492d55a96798ff0` |
| ` M` | `apps/directory-api/src/app/dto/public.dto.ts` | `63e25bfe5cb491ab5c1b20a6e1074ce22274332bc835e29cb2f09f4278acbfcc` |
| ` M` | `apps/directory-api/src/app/operator/operator.module.ts` | `aec71c289259804b61ced9ba2ca63233ade698328360a178dc567603a9253e16` |
| `??` | `apps/directory-api/src/app/taxonomy-classification/overture-taxonomy-classification.controller.ts` | `cc31c1804e4c8235e7d20869a3c97a5f7fcb4e2e70a3abab593ab44f59b54888` |
| `??` | `apps/directory-api/src/app/taxonomy-classification/overture-taxonomy-classification.dto.ts` | `c7efc070ea1bae2edd76931d36254de9efd2c61ec1fb91b4e265664ead1ae3f0` |
| `??` | `apps/directory-api/src/app/taxonomy-classification/overture-taxonomy-classification.module.ts` | `b8b01212491a3a6e074a0323ce21a579d4e24f07a7331dcfdad34cb1f597833a` |
| `??` | `apps/directory-api/src/app/taxonomy-classification/overture-taxonomy-classification.service.spec.ts` | `f2844111ffe490c477bb8516da195589bdbd8186ba8cb4cda9d689c6e1787048` |
| `??` | `apps/directory-api/src/app/taxonomy-classification/overture-taxonomy-classification.service.ts` | `f435d0c56b75dca577518bab87f9c95a44c8552533517ed32813edc5de241bf4` |
| ` M` | `apps/directory-poc/src/app/app.html` | `91ceea20c5d8fd626e48127346a1cee7d2e33f6132fac79a8696fde5aa7cd497` |
| ` M` | `apps/directory-poc/src/app/app.routes.ts` | `7055a47b80022b48541e40917951c8ee2e8353c4bcb4ea5106bef78efc337b87` |
| ` M` | `apps/directory-poc/src/app/app.scss` | `426915cb03130079b1f6d9843ad27fcd5b038d0c4cab5d95d9aaf48e851eadaa` |
| ` M` | `apps/directory-poc/src/app/pages/detail-page.component.ts` | `82d38df6e3efd361278d8bc24eca68074c76969a751ab736c4ca9dee44da6f6f` |
| ` M` | `apps/directory-poc/src/app/pages/overture-rights-review-page.component.spec.ts` | `9ec2c8d5b5aa67aea909b97a8aa7347aee3bd7c83314419eabc2fde5c45d8740` |
| ` M` | `apps/directory-poc/src/app/pages/overture-rights-review-page.component.ts` | `86663dce850083ee5da65f927a897f8a868f3c95a8f5d035e98aeaec1ed9facd` |
| ` M` | `apps/directory-poc/src/app/pages/review-page.component.spec.ts` | `6eae621458c6beeec467c7da90273d4d64cc672d2d4201e7a1efc812f1ed1eb7` |
| ` M` | `apps/directory-poc/src/app/pages/review-page.component.ts` | `02dcf4de741f39a278f90f0e30e8bdb9b982d9243aab0e00d585fbf55ed5aa49` |
| ` M` | `apps/directory-poc/src/app/pages/run-page.component.spec.ts` | `60bb5082c585c1868116043d565ed1faf0f23305a4d7021d6df2956ffbed0d87` |
| ` M` | `apps/directory-poc/src/app/pages/run-page.component.ts` | `8925182b7f7c75fd8a0b880b53cc6bb1dd1742216591e4e1296542623734a3a3` |
| ` M` | `apps/directory-poc/src/app/pages/search-page.component.ts` | `de89dc02e22447a2406a7422a1f07137ed416407f909f23ef7c19d7786fb5766` |
| `??` | `apps/directory-poc/src/app/pages/search-query.spec.ts` | `a230568af18c8692ef5100e62f6ca9de008e672ea708c3928b3725f942569058` |
| `??` | `apps/directory-poc/src/app/pages/taxonomy-classification-review-page.component.spec.ts` | `fc73a0ccac731de903739cd40d8e85d8aa9a57cae3d87cbd781dd783d0479447` |
| `??` | `apps/directory-poc/src/app/pages/taxonomy-classification-review-page.component.ts` | `33e1e2c3db6b21287529b1293e3a129089ba58d1b23e7aca5c65cc563450e7df` |
| ` M` | `apps/directory-poc/src/app/presentation-mappers.map.spec.ts` | `b23472ec2a42e87cbfa1503a7bb3c823e0bd6fe6049f2a3de31be9bad3c56be1` |
| ` M` | `apps/directory-poc/src/app/presentation-mappers.spec.ts` | `4c7ee013aba6e31a61c45139eef7accc5bc40da2a9e2ebad10d555456c7aa401` |
| ` M` | `apps/directory-poc/src/app/presentation-mappers.ts` | `36fc360d033ed44c73709bbaf343f66098e6d9862751612edf0b90ec9ef81fd9` |
| ` M` | `apps/directory-poc/src/styles.scss` | `20f711997ea89a4ef34f62ceb4d6648a44382eb9d10692bc8338678066571a1b` |
| `??` | `apps/directory-worker/src/app/queues/geoapify-reverse-locality.spec.ts` | `f696e00a05b96bd371553d86ff856f70ccbbd133ef7b7978eb31651c6f5f8fb5` |
| `??` | `apps/directory-worker/src/app/queues/overture-full-release-provider-fetch.handler.spec.ts` | `b74a4ff3f4ea3d6ee920ef23e49bc8c63bae4ff16b138dc3ef2bd2cdb5e030bc` |
| `??` | `apps/directory-worker/src/app/queues/overture-full-release-provider-fetch.handler.ts` | `eaca983ecf9dc9765135b76bc6f11120411d6d2d97b64c19462de232e25487f9` |
| `??` | `apps/directory-worker/src/app/queues/overture-full-release-reader.spec.ts` | `b4dd04b0fe1df5b2133cded785347100ce02c59c420edae36286864b500e2826` |
| `??` | `apps/directory-worker/src/app/queues/overture-full-release-reader.ts` | `b0eb20b73d0f699b6da0a42cb1029433b159b4614c60b808c6fbc208d70e0028` |
| ` M` | `apps/directory-worker/src/app/queues/overture-sample-provider-fetch.handler.spec.ts` | `9b9fa99d1f4f209ec90acc5d7c405651ad4844f8b680c96c373252d48864f248` |
| ` M` | `apps/directory-worker/src/app/queues/overture-sample-provider-fetch.handler.ts` | `957ceb02d5daec1ec4ceb838fda3c28f04fb6dd6510a38089eec3cac4c929c59` |
| ` M` | `apps/directory-worker/src/app/worker.module.ts` | `91c71ef284fa96cddef80cdd9e4e38c6e0e38b768fcec0174c6ae3fe38dce36f` |
| `??` | `docs/design-system/optimistic-tanuki-ui-migration.md` | `66c8eb38892970da7a261512dc8a90ddbe51bd1085e40401bed4a1aaa82c8c78` |
| ` M` | `docs/plans/2026-09-23-business-directory-product-recovery.md` | `d08e1b5ec9681f562729c35e50810dda78c43afe974af710c5bcc6610c4f7dbd` |
| `??` | `docs/plans/2026-09-27-local-hub-integration.md` | `073df8c47c003b034882b817a197b240aa3de203b68d263564e60374f352cd97` |
| ` M` | `docs/source-use/overture-2026-09-23-waycross.md` | `31b1256d70995ca2bb104f1daf36bd79465bd5be8e3f91cd3476a25460bc09ff` |
| ` M` | `libs/contracts/src/generated/openapi.ts` | `ef1996a44b0fe0e52c316586a19715220365e66da6b6ad82a429f0ff8a795d9c` |
| ` M` | `libs/contracts/src/index.ts` | `acc4f630283387f959c6e0da5fc2fc20c1c913ab9f99ac23d90a6efcb9e3b932` |
| ` M` | `libs/contracts/src/lib/v1/business.contracts.ts` | `b600661b2eaa90685aa167f6989aa293997590dfe0a7a5fe642886f54bc258e1` |
| ` M` | `libs/contracts/src/lib/v1/completeness.contracts.ts` | `37da9e06c80444ee1db9036d55ae0ec5fbc9fab10ac07ae57d912ed79ba64004` |
| ` M` | `libs/contracts/src/lib/v1/discovery.contracts.ts` | `17ebcb5a9b443f17dbaee117e949466a480954ecea0a6f87d7b9807629d7bd39` |
| ` M` | `libs/contracts/src/lib/v1/index.ts` | `285d3577aaa071f93af999cf75d4f0ae35e3edf25fe6a95799207780bbf0ab8b` |
| ` M` | `libs/contracts/src/lib/v1/review.contracts.ts` | `b97120bc43335741f9fb70ca4f65af4d1a5dd110ac4e1da7a2cadb791b8a180e` |
| ` M` | `libs/contracts/src/lib/v1/search.contracts.ts` | `6d24f0dcf2a3df9fdb0bf5c625c674301140d305cb32d423b7a01625b6410988` |
| `??` | `libs/contracts/src/lib/v1/taxonomy.contracts.spec.ts` | `f40169c2b5dd3ee2e624d6b3bb5f7783feb072be2a94a2a704bddff9b2b4e3bd` |
| `??` | `libs/contracts/src/lib/v1/taxonomy.contracts.ts` | `8cfb4be5fd56897327ec0c4aac7fc727c7c2fc4d7ace209a819b5a52e2cc2161` |
| ` M` | `libs/directory-data-access/src/lib/directory-api.client.ts` | `f67e9db6a157f3e1348c52df52c586ee010e0a0ee6cfe02e4ab014a638c55efa` |
| ` M` | `libs/directory-data-access/src/lib/directory-data-access/directory-data-access.spec.ts` | `e89badb51a6dbc9415c82c7b107d02049a8e7d4fe563b47b325518168bbc019b` |
| ` M` | `libs/directory-data-access/src/lib/directory-store.spec.ts` | `be1284c5b012c8b459ac1a1b70b45acf8dbb50db4b3bafda4f08b524c1d0aca1` |
| ` M` | `libs/directory-data-access/src/lib/directory-store.ts` | `ba7820ef76a437504cec5e44847ac3635b43e004b4825f722e6d6d9efefef319` |
| ` M` | `libs/directory-ui/src/index.ts` | `5dca31ab4fef185ec13f68576c8aea1099671cb6b646b0d0a614d54f2d50fd54` |
| `??` | `libs/directory-ui/src/lib/detail/business-detail.component.spec.ts` | `0125229d7f62477735c0e62db08fcbb87555206bd669608f132670da0f7cfc49` |
| ` M` | `libs/directory-ui/src/lib/detail/business-detail.component.ts` | `ccbf26bec1ac67adbfdbcd691c2f4a4166ac4f3b7ed1a9a7a462f390734d70a9` |
| ` M` | `libs/directory-ui/src/lib/evidence/evidence-panel.component.spec.ts` | `5df2629c917a0266e7e232a624792c8b15700fec78b631acd8e75e106630623e` |
| ` M` | `libs/directory-ui/src/lib/evidence/evidence-panel.component.ts` | `ffb8666f1edd398ce3d1315d0f4b94924a64a5f102910ecededd6eb41350963e` |
| ` M` | `libs/directory-ui/src/lib/map/directory-map.component.spec.ts` | `e00780a0fbd79316b518eb78a61ad79c73668fed4bd0904ed723bf518e1c6b08` |
| ` M` | `libs/directory-ui/src/lib/map/directory-map.component.ts` | `36e999d2127f9955054b97343360f4255e34b9dd2ac4f63b2a9482ab23436afa` |
| ` M` | `libs/directory-ui/src/lib/map/directory-map.provider.spec.ts` | `ac6fcca184a2b4168d38bd84db5dc2d216301ab02590c818a707160cacc160ee` |
| ` M` | `libs/directory-ui/src/lib/map/directory-map.provider.ts` | `93b3070c7573e0fcb8a5ccfb6d4a4d8bf2fd3d64c81c7a4f8a3b2e76c031ed81` |
| ` M` | `libs/directory-ui/src/lib/map/maplibre-directory-map.provider.spec.ts` | `c5e4782591e087c2c79480a11b7c584513cfa68bea0874ad91420f2567bc8d7c` |
| ` M` | `libs/directory-ui/src/lib/map/maplibre-directory-map.provider.ts` | `09286153cd07a8ab95653eef0e076d8ed5af4ea23214ec2975129cef18aec4e1` |
| ` M` | `libs/directory-ui/src/lib/models.ts` | `a712775acc2dfac434c697c0cc1761d73781bc1fce2522503328fe7e100b91af` |
| `??` | `libs/directory-ui/src/lib/results/business-results.component.spec.ts` | `7d2bb2f3223eb83d2b4218870c39527d8fad9ef18c94b061a7793cb0ffd8c4b5` |
| ` M` | `libs/directory-ui/src/lib/results/business-results.component.ts` | `fdd4029306d2365518146da01dc2662a5d1f4cd90d5b34d6f7af287383fb68d9` |
| `??` | `libs/directory-ui/src/lib/review/overture-taxonomy-classification-review.component.spec.ts` | `feaa70c606eeea8a4ee3f2d4c30af1f6151c3425377ff2d6bd10d52a1729c74b` |
| `??` | `libs/directory-ui/src/lib/review/overture-taxonomy-classification-review.component.ts` | `c229e7a70bfeb8fa84338facf6efc7fdc0ce9ae85dc54bd7f896c27b8e02ef68` |
| ` M` | `libs/directory-ui/src/lib/run/run-progress.component.spec.ts` | `2980eb3e153d239ed062082e0cde10a98885fcafdb5b66fc229a8070fbc1ce2d` |
| ` M` | `libs/directory-ui/src/lib/run/run-progress.component.ts` | `d8f6f2786f3e006271eadb5dbbf839b19d055eba568ba37ec08b281e805d337f` |
| ` M` | `libs/directory-ui/src/lib/search/directory-search.component.spec.ts` | `a3e1c1ec797e210d2decd654c1bdc92c86e3db3cf1589b8810c69d6f4c116b18` |
| ` M` | `libs/directory-ui/src/lib/search/directory-search.component.ts` | `1362cfd69296df1ed71f4f525cb03339517ae7d7143ecb5b054d1ce82634d79e` |
| ` M` | `libs/domain/src/lib/normalization/normalize-business.ts` | `330ffcb745acf1fbab73425c15ea6c750410039dac952af0661eb298c5ede334` |
| `??` | `libs/domain/src/types.ts` | `7887b754c27ba1988a05995442061f042a4794f9191f5dcb76e0bd67add194e7` |
| ` M` | `libs/orchestration/src/lib/discovery-orchestrator.service.spec.ts` | `0b1ab47573e8faf55d74ff76a027215a3ea28720cf4a651d356d1ba62bbe3a59` |
| ` M` | `libs/orchestration/src/lib/discovery-orchestrator.service.ts` | `13590097189f62dff9a70378fdead7d74dca35895410645df789ecd40d87e854` |
| ` M` | `libs/orchestration/src/lib/integration/normalization-dedupe.integration.spec.ts` | `2db7c3e6632755476bfcc89935849ce34470199a5448149283ee84c2593ffb6b` |
| `??` | `libs/orchestration/src/lib/integration/normalization-replay-preserves-address.integration.spec.ts` | `2e23d7f515a70ba5182475800404591b35d689bac5cf12f41f682101a74caace` |
| ` M` | `libs/orchestration/src/lib/normalization-dedupe.service.spec.ts` | `2e9a5356e32bb65deaf0b06517e19c053e507571af8e5af477bfae90c956c7dc` |
| ` M` | `libs/orchestration/src/lib/normalization-dedupe.service.ts` | `1a93332563e12957000a62359fad87836671b2e1ce168993092fed21f184b3a0` |
| ` M` | `libs/orchestration/src/lib/provider-fetch.service.spec.ts` | `af0e7e0da645a517579f5316ef82f2d7ba4cc5bae596cd3074af2d6e6065cc1c` |
| ` M` | `libs/orchestration/src/lib/provider-fetch.service.ts` | `91e387824ec41d88411d33517e1073f90c984a1677013a3cec6ab9f0a29ef250` |
| ` M` | `libs/persistence/src/index.ts` | `db76d7101fbf21eeb4652d1dfdef9795b29fe1a18a4847a97a9cba2e137e8e9a` |
| ` M` | `libs/persistence/src/lib/business/business-persistence.spec.ts` | `1f89dfcaf1b807f415c6c9888f94cd8dbde0b86368128d95d11eda8841de9a80` |
| ` M` | `libs/persistence/src/lib/business/business.repository.ts` | `6c8d67d7079f3d14053b2b417bb4d09b6d6cc01cfdb1f2dc80909bfb5ec3fecb` |
| `??` | `libs/persistence/src/lib/business/field-evidence.repository.spec.ts` | `db13307042f288cbf792137c618c6cd67aef760171884e0653c2d43284dbbdf3` |
| ` M` | `libs/persistence/src/lib/business/field-evidence.repository.ts` | `1f5da0556ae656ae997f652947619273b584c020cf426ed2f165d55cb8ead34a` |
| `??` | `libs/persistence/src/lib/business/search.repository.spec.ts` | `2a22fa78d7fa66d9b9899bbd252b12e581e5ef7e0ff55059f7108e8ca2352cc4` |
| ` M` | `libs/persistence/src/lib/business/search.repository.ts` | `34b205e364f17f73bb3f0e2a74b516c7d75a6c83a8f98f915d49f0edc204409f` |
| `??` | `libs/persistence/src/lib/business/taxonomy-reclassification-plan.spec.ts` | `febde747942b7742ac32685fccedc43b48f578b2eb8c055d9be49a6c97d5f249` |
| `??` | `libs/persistence/src/lib/business/taxonomy-reclassification-plan.ts` | `cce41d620cae5cfa5e63b79cad40be9628d50b7f198501cf153f1c82be404c7f` |
| `??` | `libs/persistence/src/lib/business/taxonomy-reclassification-protocol.spec.ts` | `1645a8cb82042757e73c293a02159553602ef7803d01f376b353edb61f2c2708` |
| `??` | `libs/persistence/src/lib/business/taxonomy-reclassification-protocol.ts` | `4791ff77dcbdf70afa59ab1000d2b18d1d5fb88b56ff082f40ad5d0d9a1571b6` |
| ` M` | `libs/persistence/src/lib/entities/business.entity.ts` | `56e2da93794b5ce3da32b4a3f3dcffa772112deb50413c1e0f0398d3f6e19251` |
| ` M` | `libs/persistence/src/lib/entities/index.ts` | `efee34e489f6a0070f5b9e95f1c86fef01a5ca67a832fed08d29882f60fec5d6` |
| `??` | `libs/persistence/src/lib/entities/overture-taxonomy-classification-case.entity.ts` | `0d8417428b1458396c171c29b3f87ac4d6c733680bf720d05915a815a3dc0dbd` |
| `??` | `libs/persistence/src/lib/entities/overture-taxonomy-classification-event.entity.ts` | `fd2ae36177045074127caed6b40c097c5f3b4242b23f95363f1f9a176361fa70` |
| `??` | `libs/persistence/src/lib/entities/overture-taxonomy-quality-exclusion.entity.ts` | `0429b8541f90714acd812038f91d470302de1d31fb1746a296cb120880e218fd` |
| `??` | `libs/persistence/src/lib/idempotency/discovery-run.repository.spec.ts` | `56190c6633b0c643f1d7139978a1422b8cf0bbafa49b2463547071cbed6a4122` |
| ` M` | `libs/persistence/src/lib/idempotency/discovery-run.repository.ts` | `7854e630d7c26efd6de86ba4269fb21de83fb0d717ba4a98c4bc7537f2bbed98` |
| ` M` | `libs/persistence/src/lib/idempotency/discovery-state.service.spec.ts` | `f037efdba087b4a950253330ecbf94c459d882ac20344ecc7ea96965e0cc59f7` |
| ` M` | `libs/persistence/src/lib/idempotency/discovery-state.service.ts` | `7358389de88c7c3b08a74555785104e3ba0f47a0ed7238681816cbbe2c793ab4` |
| ` M` | `libs/persistence/src/lib/integration/business-persistence.integration.spec.ts` | `bf163dede0c5d82eae63db675186c088e8533fdb2f9960588c110c0faa26a3f1` |
| ` M` | `libs/persistence/src/lib/integration/export-outbox.integration.spec.ts` | `d59a4140dc278e1a27728dd4c625b73bba8666a15cae42509713c205b7b3cf5b` |
| ` M` | `libs/persistence/src/lib/integration/persistence.integration.spec.ts` | `4441c89ac73aa535aede8baf09fa1aff75296ecbbfdd04744bc9b030e683ae18` |
| ` M` | `libs/persistence/src/lib/integration/review-persistence.integration.spec.ts` | `7c9814c0302837894efa37333f5d088e21fee63065a57f4dd429082ae536f2b8` |
| ` M` | `libs/persistence/src/lib/integration/search-export.integration.spec.ts` | `c96c4b1ad2a17beab2d74ccdf8c77b36914f60589126f7582cdc1c925a4ddfba` |
| `??` | `libs/persistence/src/lib/migrations/1710000017000-OvertureTaxonomyQualityExclusions.ts` | `fc41ad93bc7fd4b974b79276550e17320c5b105b693e3d9c16e150fa63229c20` |
| `??` | `libs/persistence/src/lib/migrations/1710000018000-OvertureTaxonomyClassificationCases.ts` | `251df24f8d0f2e42084ca4a56997893f67117058345f34704b6c9bb3c02d1f54` |
| `??` | `libs/persistence/src/lib/migrations/1710000019000-DirectoryTaxonomyClassificationOptions.ts` | `fce53a558840feeba2bc48dd17221a537870ea40a4d23948372f62bd866822dd` |
| `??` | `libs/persistence/src/lib/migrations/1710000020000-DirectoryBusinessTaxonomyFacet.ts` | `380e75fbbccfc941d9faae2e3ae95749d95bd4e27bbc32ff031cefb459d277f9` |
| `??` | `libs/persistence/src/lib/migrations/1710000021000-TaxonomyEvidenceReplayIdentity.ts` | `64fe1d8408fb42f7e790398ca7fc3a27e153c6c05da8e68db80d698acc91c18b` |
| `??` | `libs/persistence/src/lib/migrations/1710000022000-DirectoryPlaceTypeEvidenceLookup.ts` | `bbc6a437fd3a7af221196b4e27acd77b6e9468a5ff0329b1cc601159c5e76fc3` |
| ` M` | `libs/persistence/src/lib/persistence-schema.spec.ts` | `34fb9560d891b943301f25f88a03954d8dea41ba1e5697f6c74e2012c6acc6f0` |
| ` M` | `libs/persistence/src/lib/persistence.module.spec.ts` | `ca8b143b07ed314a916c88bc4974076e7fcc33463006a597f0a2508471bc7f5e` |
| ` M` | `libs/persistence/src/lib/persistence.module.ts` | `78422ff6f69f6528072f78f9efdfdf419f1648d80226601a1ccfc7cbb6f95afd` |
| `??` | `libs/persistence/src/lib/quality/overture-taxonomy-classification.module.ts` | `c3742eab6130974276fb16fd0df5b0492e8771a5b315b028f4668b00536b0da2` |
| `??` | `libs/persistence/src/lib/quality/overture-taxonomy-classification.repository.spec.ts` | `eb22b975cc1a5538b186c7a200c33ec1c45c4b9a8452104018d73045be821497` |
| `??` | `libs/persistence/src/lib/quality/overture-taxonomy-classification.repository.ts` | `947b01b223dedd56bede6860ff2769f7545f097b058a9a454bf21930a55b702a` |
| `??` | `libs/persistence/src/lib/quality/overture-taxonomy-quality.repository.spec.ts` | `68a69b113d21d1049f702c978954a38e1d53f8cb255e9942cd27910c336b1c6b` |
| `??` | `libs/persistence/src/lib/quality/overture-taxonomy-quality.repository.ts` | `556153e6cf72d92318506d97abe9b6fea8578cf58cb352546042d561830babae` |
| ` M` | `libs/persistence/src/lib/review/review-adjudication.service.ts` | `b470b22b5567527efd84ed32e1ab50a0ae247f7ce4502fbf9244505527fb5281` |
| ` M` | `libs/persistence/src/lib/review/review-adjudication.spec.ts` | `45d835f3bb6872cb62cebdc87099c06ba7902ed1c2473c663c678b85ba7127a8` |
| ` M` | `libs/providers/src/index.ts` | `5cbdd1a46e46590d2b1c4b8d6c710f476b31bd0736b907a038263c2642e27869` |
| `??` | `libs/providers/src/lib/overture/overture-address.spec.ts` | `fa3c3b7fd2d37d64f81ad42b0aa7cb889e23784af4f210703843a2294307aa2b` |
| `??` | `libs/providers/src/lib/overture/overture-address.ts` | `3ec91fb96b2bd42045b975148a37043a74c6b84906cf91c4f4777df8010b9043` |
| ` M` | `libs/providers/src/lib/overture/overture-bulk-reader.ts` | `4645b01775a2b543020dbdb3110d6e756f996a01f99beddda2c93ff21e592461` |
| `??` | `libs/providers/src/lib/overture/overture-checkpoint.spec.ts` | `81bcc692a80135d08746a07a7573dfd9a4d7206f00e01983ef869d423ec2d840` |
| `??` | `libs/providers/src/lib/overture/overture-checkpoint.ts` | `2b6cd6e386394c5ce39dfd77deeab9d927fcda4848f6ec508a315fef3338b7a0` |
| ` M` | `libs/providers/src/lib/overture/overture-official-row.spec.ts` | `5523845091a44b738c0a535a090c2cb52f2a8b2da567916b47e618040e49c0b1` |
| ` M` | `libs/providers/src/lib/overture/overture-official-row.ts` | `26456cdf02765155aba534779e53282892c3ab4994e5bc2d00e9f7a23b599dce` |
| ` M` | `libs/providers/src/lib/overture/overture-places.adapter.spec.ts` | `c4fb447762621e43938092e11f42ddbaf0f01c40bf0df8c750f07b4f5488b52d` |
| ` M` | `libs/providers/src/lib/overture/overture-places.adapter.ts` | `573df81d96d2ec0eeb9dfcf662c4bbdb73ae199efc2dd7411dc1b52fe10db8f3` |
| `??` | `libs/providers/src/lib/overture/overture-regional-policy.ts` | `b7ff6982cb3facf6003c52aa54cbec6b82cd6fdf3a4490a6d543a1b8baecc7c1` |
| `??` | `libs/providers/src/lib/overture/overture-release-scan.spec.ts` | `f4542f9ae0773f0ebe358d9bbf911d7acde92e62076a3d643ed9e5e9ccb6b8f4` |
| `??` | `libs/providers/src/lib/overture/overture-release-scan.ts` | `a979fe851d45dc0292a0d402cdc9cf776c6d810034bb4b17f7f86dd48bcd87cb` |
| ` M` | `libs/providers/src/lib/overture/overture-rights-policy.ts` | `d1f44971555af1bfc62d6fadc59762f1f97255f4c0421b9e1336e68af2e8b009` |
| ` M` | `libs/providers/src/lib/overture/overture-sample-reader.ts` | `34d2c9e1f25dae9e66b94fd30dac5735944a08e66229dd4cc58a0737574f771a` |
| ` M` | `libs/providers/src/lib/provider-adapter.ts` | `06569e70a72b3af93d2256ed0b01b41d72298221389c0114f328fff8a16d24ec` |
| ` M` | `libs/providers/src/lib/provider-policy.spec.ts` | `70a8e94cc5a23405684eb0cf842a7bc1e153032291cde7c731e771b1de25e38c` |
| ` M` | `libs/providers/src/lib/provider-policy.ts` | `39119e836bc069ca5f94e035ea9fc8d40ff57798c806df09a777f3b5eebac6ff` |
| ` M` | `libs/providers/src/lib/taxonomy/taxonomy-v1.spec.ts` | `47f9f4b6268e6e7ab38a20517f205821cc9156806a7371d41e938381ab0f818b` |
| ` M` | `libs/providers/src/lib/taxonomy/taxonomy-v1.ts` | `f29b405c5b97aef9c409129cbfd305d812054b37819ddcbc1f23aad6b1a6d416` |
| ` M` | `libs/search/src/lib/search.spec.ts` | `7cb87665f04922c6a91b0c39f275d2c868276253010aa16c9fbd4d06fbc4bc74` |
| ` M` | `libs/search/src/lib/search.ts` | `27c90c2014dcd6b97cb6fa4d12b6ecd97853740f2394e5bd3cc4c57531d73b91` |
| `??` | `tools/overture/address-correction-runner.ts` | `275a78282cbfffb95e59c29bb3e9ada1c256f7a4e6e8342398b8b54a7f37fdc6` |
| `??` | `tools/overture/fetch-four-seat-scan.ts` | `b4d42b75ce91417bb726ab6c26794fe76f529f83f5b277de469cca17b2575e74` |
| `??` | `tools/overture/geoapify-reverse-locality-runner.ts` | `3fdfb6c8612d30a89559eec14d2b2b760ffed41472508e9ff049d11608f3101a` |
| `??` | `tools/overture/geoapify-reverse-locality.ts` | `4a44a3c62f8040513a81fda4931cb6e8525db202a58aeb1d461a8b5a7e5b1c29` |
| `??` | `tools/overture/reclassify-four-seat-scan-v3.ts` | `6590202b7befedf3830feadf6fa827b3c007e51c061cad2b016b3687fa485f8f` |
| `??` | `tools/overture/reclassify-four-seat-scan.ts` | `ccfba84bf56da66a89ce63430cd5d09abdaa88ed59ffb186181e8c360fe499a6` |
| `??` | `tools/overture/taxonomy-reclassification-runner.ts` | `f3e6ea7d2c08a55126f99d6d80c5404c85b12ce43b40ae7c1ae145174ab85c13` |
| ` M` | `tools/typeorm/data-source.ts` | `a0c3c2f38be31a3916d72ca9905d68484baf57ea21e3fa4cad699ee23673bf5b` |

Included safe code/test/documentation files: **165**.

## Relevant ignored artifact manifests

Only these plan-relevant ignored manifests were checked by exact path and hashed (without reading their contents into output). Data payload files, including GeoJSON/JSONL payloads, were not hashed. No ignored build/cache/dependency artifacts were inventoried. If a listed manifest was absent or not ignored, it is omitted; no such path was treated as evidence of rights clearance.

| Safe relative path | SHA-256 |
|---|---|
| `data/geo/input-manifest.json` | `c704bf2387266e98e39addddde62c6647699555b50f86d7fb185cc74d6deb40e` |
| `data/geo/census-proxy.geojson.provenance.json` | `7d85af32125c3c2522a9bd2352ef041b6e495eb8fef2ae2c7e2ec173f3a9e70d` |
| `data/providers/overture/2026-09-23.0/four-seat-places-v3.manifest.json` | `edf67913b52fc16dc71c6b735758e4627431a87eb3d805292507a35f5a754d02` |
| `data/providers/overture/2026-09-23.0/four-seat-places.manifest.json` | `7f43ebf8b964d69cdbc843d61e0c305316e3ce206237e37f67d6803d8c7d8422` |
| `data/providers/overture/2026-09-23.0/waycross-places-usable.manifest.json` | `88c8cec77601b5d4ae22190f84a332f9e3f4020272dd27f125f41742f4cc3b4b` |

## Exclusions

- `.env` files, credentials, API tokens, certificates, private keys, and other secrets; private configuration and operational secrets.
- Data payloads and derived records, including GeoJSON, JSONL, database exports, provider response bodies, and proof/replay output payloads.
- Browser automation captures/logs, including `.playwright-mcp/` page and console artifacts.
- Ignored build outputs, Nx/Angular caches, `dist/`, dependency trees, temporary databases, and generated files.
- Operational/deployment/project configuration (including container compose and compiler configuration), provider configuration/manifests outside the specifically listed ignored lineage manifests, and map style JSON.
- Any path whose classification could not be safely established from its path/type alone.

No excluded file contents were inspected for this manifest, copied, or retained. Secret-bearing ignored paths were not opened or hashed.

## Drift and acceptance caveat

This is a point-in-time, deliberately partial record. Source status can change immediately after capture. Before any later authorized transfer, re-observe status and hashes, compare against this manifest, and separately approve any archive or content handling. The current S0 plan requires fuller reproducible evidence and human approval; this manifest alone does not satisfy that gate.
