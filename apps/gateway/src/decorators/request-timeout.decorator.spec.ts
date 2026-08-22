import { REQUEST_TIMEOUT_METADATA } from './request-timeout.decorator';

/**
 * The preset values matter more than the plumbing: a model-backed route cut off
 * mid-generation is indistinguishable, to the user, from the feature being
 * broken. These pin the two properties that took real debugging to establish.
 */
describe('request timeout presets', () => {
  const load = async () => {
    jest.resetModules();
    return import('./request-timeout.decorator');
  };

  const metadataOf = (decorator: MethodDecorator | ClassDecorator) => {
    class Target {}
    (decorator as ClassDecorator)(Target);
    return Reflect.getMetadata(REQUEST_TIMEOUT_METADATA, Target);
  };

  afterEach(() => {
    delete process.env['GATEWAY_MODEL_TIMEOUT_MS'];
    jest.resetModules();
  });

  it('gives model-backed routes far longer than the long-running preset', async () => {
    const mod = await load();

    // 120s cut off topic analysis, which measured 164-332s locally.
    expect(mod.MODEL_BOUND_REQUEST_TIMEOUT_MS).toBeGreaterThan(
      mod.LONG_RUNNING_REQUEST_TIMEOUT_MS
    );
    expect(mod.MODEL_BOUND_REQUEST_TIMEOUT_MS).toBe(600_000);
  });

  it('stays bounded rather than disabled', async () => {
    const mod = await load();

    // The whole point of the preset over `'none'`: a hung model must eventually
    // release the connection.
    expect(metadataOf(mod.ModelBound())).toBe(600_000);
    expect(metadataOf(mod.ModelBound())).not.toBe('none');
  });

  it('can be dialled down per environment', async () => {
    process.env['GATEWAY_MODEL_TIMEOUT_MS'] = '90000';
    const mod = await load();

    expect(mod.MODEL_BOUND_REQUEST_TIMEOUT_MS).toBe(90_000);
  });

  it('ignores a nonsense override instead of disabling the timeout', async () => {
    process.env['GATEWAY_MODEL_TIMEOUT_MS'] = 'soon';
    const mod = await load();

    expect(mod.MODEL_BOUND_REQUEST_TIMEOUT_MS).toBe(600_000);
  });
});
