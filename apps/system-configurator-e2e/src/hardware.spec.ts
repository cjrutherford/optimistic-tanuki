import { test, expect } from '@playwright/test';

const authToken =
  'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJ1c2VySWQiOiJ1c2VyLTEiLCJwcm9maWxlSWQiOiJwcm9maWxlLTEiLCJlbWFpbCI6ImFsZXhAaGFpLmV4YW1wbGUifQ.';

const mockChassis = [
  {
    id: 'xs-cloud',
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
    isActive: true,
  },
  {
    id: 's-cloud',
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
    isActive: true,
  },
];

const mockCompatibleComponents = {
  cpu: [
    {
      id: 'cpu-1',
      type: 'cpu',
      name: 'Raspberry Pi 5 8GB',
      description: 'Integrated ARM SoC board for XS cloud builds.',
      basePrice: 80,
      sellingPrice: 80,
      specs: { cores: 4, frequency: '2.4 GHz ARM' },
      compatibleWith: ['xs-cloud'],
      inStock: true,
      isActive: true,
    },
  ],
  ram: [
    {
      id: 'ram-1',
      type: 'ram',
      name: '8GB LPDDR4X Onboard',
      description: 'Integrated memory for Raspberry Pi 5.',
      basePrice: 0,
      sellingPrice: 0,
      specs: { capacity: '8GB', speed: 'LPDDR4X' },
      compatibleWith: ['xs-cloud'],
      inStock: true,
      isActive: true,
    },
  ],
  storage: [
    {
      id: 'storage-1',
      type: 'storage',
      name: '256GB NVMe for Pi HAT+',
      description: 'Compact storage for Pi-class builds.',
      basePrice: 35,
      sellingPrice: 35,
      specs: { capacity: '256GB', type: 'NVMe SSD' },
      compatibleWith: ['xs-cloud'],
      inStock: true,
      isActive: true,
    },
  ],
  gpu: [
    {
      id: 'gpu-1',
      type: 'gpu',
      name: 'Integrated VideoCore',
      description: 'No discrete GPU in XS Pi builds.',
      basePrice: 0,
      sellingPrice: 0,
      specs: { vram: 'Shared' },
      compatibleWith: ['xs-cloud'],
      inStock: true,
      isActive: true,
    },
  ],
};

const mockPriceBreakdown = {
  chassisPrice: 16,
  cpuPrice: 80,
  ramPrice: 0,
  storagePrice: 35,
  gpuPrice: 0,
  casePrice: 0,
  accessoriesPrice: 0,
  assemblyFee: 79,
  totalPrice: 210,
};

const mockDraft = {
  chassisId: 'xs-cloud',
  chassisType: 'XS',
  useCase: 'cloud',
  cpuId: 'cpu-1',
  ramId: 'ram-1',
  storageIds: ['storage-1'],
  gpuId: '',
};

const mockProfile = {
  id: 'profile-1',
  userId: 'user-1',
  profileName: 'HAI Primary',
  profilePic: '',
  coverPic: '',
  bio: '',
  location: '',
  occupation: 'Systems integrator',
  interests: 'systems integration',
  skills: 'hardware configuration',
  appScope: 'system-configurator',
};

const mockCheckoutDraft = {
  shipping: {
    name: 'Alex Integrator',
    street: '204 Deployment Lane',
    city: 'Savannah',
    state: 'Georgia',
    zip: '31401',
    country: 'USA',
  },
  customerEmail: 'alex@hai.example',
  paymentMethod: 'card',
};

async function mockHardwareApi(page: Parameters<typeof test>[0]['page']) {
  await page.route('**/api/hardware/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (request.method() === 'GET' && path.endsWith('/api/hardware/chassis')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockChassis),
      });
      return;
    }

    if (request.method() === 'GET' && path.endsWith('/api/hardware/chassis/xs-cloud')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockChassis[0]),
      });
      return;
    }

    if (
      request.method() === 'GET' &&
      path.endsWith('/api/hardware/chassis/xs-cloud/compatible')
    ) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCompatibleComponents),
      });
      return;
    }

    if (
      request.method() === 'POST' &&
      path.endsWith('/api/hardware/pricing/calculate')
    ) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockPriceBreakdown),
      });
      return;
    }

    if (request.method() === 'POST' && path.endsWith('/api/hardware/orders')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'order-1',
          configuration: mockDraft,
          priceBreakdown: mockPriceBreakdown,
          shippingAddress: mockCheckoutDraft.shipping,
          customerEmail: mockCheckoutDraft.customerEmail,
          paymentMethod: mockCheckoutDraft.paymentMethod,
          status: 'payment_pending',
          estimatedDelivery: '2026-04-30T00:00:00.000Z',
          createdAt: '2026-04-02T00:00:00.000Z',
        }),
      });
      return;
    }

    if (request.method() === 'GET' && path.endsWith('/api/hardware/orders/order-1')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'order-1',
          configuration: mockDraft,
          priceBreakdown: mockPriceBreakdown,
          shippingAddress: mockCheckoutDraft.shipping,
          customerEmail: mockCheckoutDraft.customerEmail,
          paymentMethod: mockCheckoutDraft.paymentMethod,
          status: 'payment_pending',
          estimatedDelivery: '2026-04-30T00:00:00.000Z',
          createdAt: '2026-04-02T00:00:00.000Z',
        }),
      });
      return;
    }

    await route.abort();
  });

  await page.route('**/api/profile', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([mockProfile]),
    });
  });
}

async function seedAuthenticatedSession(
  page: Parameters<typeof test>[0]['page'],
  options?: { withDraft?: boolean }
) {
  await page.addInitScript(
    ({ token, profile, draft, checkoutDraft, withDraft }) => {
      localStorage.setItem('hai-system-configurator-authToken', token);
      localStorage.setItem(
        'hai-system-configurator-profiles',
        JSON.stringify([profile])
      );
      localStorage.setItem(
        'hai-system-configurator-selectedProfile',
        JSON.stringify(profile)
      );

      if (withDraft) {
        localStorage.setItem(
          'hai-system-configurator-draft',
          JSON.stringify(draft)
        );
        localStorage.setItem(
          'hai-system-configurator-checkout',
          JSON.stringify(checkoutDraft)
        );
      }
    },
    {
      token: authToken,
      profile: mockProfile,
      draft: mockDraft,
      checkoutDraft: mockCheckoutDraft,
      withDraft: options?.withDraft ?? false,
    }
  );
}

test.describe('System Configurator', () => {
  test.beforeEach(async ({ page }) => {
    await mockHardwareApi(page);
  });

  test('renders the landing page with the current hero copy and system cards', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page.locator('h1')).toContainText(
      'Purpose-built systems for teams that need calm, durable compute.'
    );
    await expect(page.locator('.system-card')).toHaveCount(2);
    await expect(page.locator('.system-card').first()).toContainText(
      'HAI XS Cloud Node'
    );
  });

  test('navigates through configure and review using the actual UI selectors', async ({
    page,
  }) => {
    await page.goto('/');

    await page.locator('.system-card').first().click();
    await expect(page).toHaveURL(/\/configure\/xs-cloud/);
    await expect(page.locator('h1')).toContainText('HAI XS Cloud Node');
    await expect(page.locator('.option-card')).toHaveCount(4);
    await expect(page.locator('.continue-action')).toBeEnabled();
    await expect(page.locator('.summary-card')).toContainText('$210');

    await page.locator('.continue-action').click();
    await expect(page).toHaveURL(/\/review/);
    await expect(page.locator('h1')).toContainText(
      'Review your system before checkout'
    );
    await expect(page.locator('.price-card')).toContainText('Estimated order total');
    await expect(page.locator('.checkout-action')).toBeVisible();
  });

  test('redirects unauthenticated users from checkout to login', async ({ page }) => {
    await page.addInitScript(({ draft, checkoutDraft }) => {
      localStorage.setItem('hai-system-configurator-draft', JSON.stringify(draft));
      localStorage.setItem(
        'hai-system-configurator-checkout',
        JSON.stringify(checkoutDraft)
      );
    }, { draft: mockDraft, checkoutDraft: mockCheckoutDraft });

    await page.goto('/checkout');

    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('body')).toContainText('Welcome to HAI Computer');
  });

  test('allows an authenticated user with a selected profile to access checkout', async ({
    page,
  }) => {
    await seedAuthenticatedSession(page, { withDraft: true });

    await page.goto('/checkout');

    await expect(page).toHaveURL(/\/checkout/);
    await expect(page.locator('h1')).toContainText(
      'Shipping and payment coordination'
    );
    await expect(page.locator('.submit-action')).toBeEnabled();
    await expect(page.locator('.profile-note')).toContainText('Active profile');
  });

  test('loads the confirmation page for an authenticated session', async ({ page }) => {
    await seedAuthenticatedSession(page, { withDraft: true });

    await page.goto('/confirmation/order-1');

    await expect(page).toHaveURL(/\/confirmation\/order-1/);
    await expect(page.locator('h1')).toContainText(
      'Order accepted into the integration queue.'
    );
    await expect(page.locator('.confirmation-grid')).toContainText('order-1');
    await expect(page.locator('.shipping-panel')).toContainText('Alex Integrator');
  });
});
