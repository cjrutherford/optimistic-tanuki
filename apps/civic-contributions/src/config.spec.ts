import * as path from 'path';
import loadConfig from './config';

describe('loadConfig', () => {
  it('defaults the platform wiring', () => {
    const config = loadConfig({});
    expect(config.listenPort).toBe(3029);
    expect(config.civicBriefing).toEqual({
      host: 'civic-briefing',
      port: 3028,
    });
    expect(config.llmTransport).toBe('prompt-proxy');
    expect(config.promptProxy).toEqual({ host: 'prompt-proxy', port: 3009 });
    expect(config.localitiesDir).toBeNull();
  });

  it('keeps data directories under the working directory unless told otherwise', () => {
    const config = loadConfig({});
    expect(config.artifactRoot).toBe(
      path.resolve(process.cwd(), 'data/community-artifacts')
    );
    expect(config.promotionDirectory).toBe(
      path.resolve(process.cwd(), 'data/community-promotions')
    );
    expect(config.densityDirectory).toBe(
      path.resolve(process.cwd(), 'data/community-density')
    );
    const moved = loadConfig({
      DENSITY_DIRECTORY: '/srv/density',
      PROMOTION_DIRECTORY: '/srv/promotions',
      ARTIFACT_ROOT: '/srv/artifacts',
    });
    expect(moved.densityDirectory).toBe('/srv/density');
    expect(moved.promotionDirectory).toBe('/srv/promotions');
    expect(moved.artifactRoot).toBe('/srv/artifacts');
  });

  it('reads the environment', () => {
    const config = loadConfig({
      CIVIC_BRIEFING_HOST: 'briefing.test',
      CIVIC_BRIEFING_PORT: '4028',
      LLM_TRANSPORT: 'direct',
      PROMPT_PROXY_HOST: 'proxy.test',
      PROMPT_PROXY_PORT: '4009',
      CIVIC_LOCALITIES_DIR: '/srv/localities',
      CONTRIBUTIONS_PER_HOUR: '3',
      STANDING_CONTRADICTED: '0.4',
    });
    expect(config.civicBriefing).toEqual({ host: 'briefing.test', port: 4028 });
    expect(config.llmTransport).toBe('direct');
    expect(config.promptProxy).toEqual({ host: 'proxy.test', port: 4009 });
    expect(config.localitiesDir).toBe('/srv/localities');
    expect(config.hourlyLimit).toBe(3);
    expect(config.standing.contradicted).toBe(-0.4);
  });

  it('refuses a transport it does not know and a number that is not one', () => {
    expect(() => loadConfig({ LLM_TRANSPORT: 'carrier-pigeon' })).toThrow(
      /LLM_TRANSPORT/u
    );
    expect(() => loadConfig({ CIVIC_BRIEFING_PORT: 'abc' })).toThrow(
      /CIVIC_BRIEFING_PORT/u
    );
  });
});
