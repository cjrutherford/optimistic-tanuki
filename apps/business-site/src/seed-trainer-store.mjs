const EMBERLINE_CATALOG_NAME = 'Emberline Studio Collection';

export const EMBERLINE_STORE_PRODUCTS = [
  {
    name: 'Emberline Studio Mini Print Set',
    description:
      'Set of three archival mini prints featuring Emberline Studio landscape and portrait studies, packaged for ready-to-ship collector orders.',
    priceCents: 3600,
    type: 'physical',
    imageUrl: '/assets/products/emberline-mini-print-set.jpg',
    stock: 18,
    active: true,
  },
  {
    name: 'Emberline Studio Sticker Sheet',
    description:
      'Illustrated vinyl sticker sheet with studio mascots, brush motifs, and signature Emberline color accents.',
    priceCents: 800,
    type: 'physical',
    imageUrl: '/assets/products/emberline-sticker-sheet.jpg',
    stock: 42,
    active: true,
  },
  {
    name: 'Original Gouache Landscape',
    description:
      'One-of-a-kind gouache painting from the current Emberline Studio release, sealed and ready to ship with collector notes.',
    priceCents: 24000,
    type: 'physical',
    imageUrl: '/assets/products/emberline-gouache-landscape.jpg',
    stock: 4,
    active: true,
  },
  {
    name: 'Emberline Commission Planning Session',
    description:
      'A paid planning consult for collector goals, portrait references, medium selection, and turnaround before a commission slot is reserved.',
    priceCents: 4500,
    type: 'service',
    stock: 999,
    active: true,
  },
  {
    name: 'Emberline Custom Pet Portrait Commission',
    description:
      'Store-backed commission slot for a custom pet portrait with concept review and delivery timeline.',
    priceCents: 32000,
    type: 'service',
    stock: 24,
    active: true,
  },
];

function requireSuccessfulResponse(response, stage, subject) {
  if (!response || response.status < 200 || response.status >= 300) {
    throw new Error(
      `${stage} failed for ${subject} (${
        response?.status ?? 'unknown'
      }): ${JSON.stringify(response?.data)}`
    );
  }
}

function requireId(data, stage, subject) {
  const id = data?.id || data?.catalog?.id || data?.product?.id;
  if (!id) {
    throw new Error(`${stage} returned no id for ${subject}`);
  }
  return id;
}

/**
 * Seed the Store catalog behind a Store-enabled Business Site tenant.
 *
 * All mutations go through the authenticated Gateway APIs. The existing
 * workspace catalog and its products are reused so this is safe to rerun.
 */
export async function seedStoreCatalogForTenant({
  tenant,
  owner,
  workspace,
  fetchJson,
  gatewayUrl = '',
  logger = { log: () => undefined },
}) {
  if (
    !tenant?.features?.store?.enabled ||
    tenant?.serviceCatalog?.source !== 'store'
  ) {
    return null;
  }
  if (!owner?.token) {
    throw new Error(
      `Store seed requires an owner token for ${tenant.site.slug}`
    );
  }
  if (!workspace?.workspaceId) {
    throw new Error(
      `Store seed requires a resolved workspace for ${tenant.site.slug}`
    );
  }
  const workspaceSlug = workspace.slug || tenant.site.slug;

  const apiUrl = (path) => `${gatewayUrl.replace(/\/$/, '')}${path}`;

  const authHeaders = { Authorization: `Bearer ${owner.token}` };
  const workspaceQuery = `workspaceSlug=${encodeURIComponent(workspaceSlug)}`;
  const catalogList = await fetchJson(
    apiUrl(`/store/catalogs/mine?${workspaceQuery}`),
    { headers: authHeaders }
  );
  requireSuccessfulResponse(
    catalogList,
    'Store catalog lookup',
    tenant.site.slug
  );
  if (!Array.isArray(catalogList.data)) {
    throw new Error(
      `Store catalog lookup returned an invalid list for ${tenant.site.slug}`
    );
  }

  let catalog = catalogList.data.find(
    (candidate) => candidate?.name === EMBERLINE_CATALOG_NAME
  );
  if (!catalog) {
    logger.log(`Creating Store catalog for ${tenant.site.slug}...`);
    const catalogResponse = await fetchJson(
      apiUrl(`/store/catalogs?${workspaceQuery}`),
      {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          name: EMBERLINE_CATALOG_NAME,
          description:
            'Ready-to-ship originals, prints, merch, and commission services.',
        }),
      }
    );
    requireSuccessfulResponse(
      catalogResponse,
      'Store catalog creation',
      tenant.site.slug
    );
    catalog = catalogResponse.data;
  }
  const catalogId = requireId(catalog, 'Store catalog', tenant.site.slug);

  const productList = await fetchJson(
    apiUrl(`/store/products?catalogId=${encodeURIComponent(catalogId)}`),
    {
      headers: authHeaders,
    }
  );
  requireSuccessfulResponse(
    productList,
    'Store product lookup',
    tenant.site.slug
  );
  if (!Array.isArray(productList.data)) {
    throw new Error(
      `Store product lookup returned an invalid list for ${tenant.site.slug}`
    );
  }
  const existingNames = new Set(
    productList.data
      .filter((product) => product?.catalogId === catalogId)
      .map((product) => product?.name)
  );

  const productNames = [];
  for (const product of EMBERLINE_STORE_PRODUCTS) {
    if (existingNames.has(product.name)) {
      productNames.push(product.name);
      continue;
    }
    logger.log(
      `Creating Store product ${product.name} for ${tenant.site.slug}...`
    );
    const productResponse = await fetchJson(
      apiUrl(`/store/products?${workspaceQuery}`),
      {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ ...product, catalogId }),
      }
    );
    requireSuccessfulResponse(
      productResponse,
      'Store product creation',
      product.name
    );
    requireId(productResponse.data, 'Store product', product.name);
    productNames.push(product.name);
  }

  return { catalogId, productNames };
}
