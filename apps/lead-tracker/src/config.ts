import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import 'pg';

export declare type LeadTrackerConfigType = {
  listenPort: number;
  ollama: {
    host: string;
    port: number;
    model: string;
    temperature: number;
    timeoutMs: number;
  };
  database: {
    host: string;
    port: number;
    username: string;
    password: string;
    name?: string;
    database?: string;
  };
  leadDiscovery: {
    search: {
      enabled: boolean;
      provider: string;
      requestTimeoutMs: number;
      userAgent: string;
      maxResultsPerQuery: number;
      maxQueriesPerProvider: number;
      googleApiKey?: string;
      googleCx?: string;
      locale: string;
    };
    remoteOk: {
      enabled: boolean;
    };
    himalayas: {
      enabled: boolean;
    };
    weWorkRemotely: {
      enabled: boolean;
    };
    justRemote: {
      enabled: boolean;
    };
    jobicy: {
      enabled: boolean;
    };
    clutch: {
      enabled: boolean;
    };
    crunchbase: {
      enabled: boolean;
    };
    indeed: {
      enabled: boolean;
    };
    googleMaps: {
      enabled: boolean;
      apiKey?: string;
      textSearchUrl?: string;
      autocompleteUrl?: string;
      maxResults: number;
    };
  };
};

const toBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const toNumber = (value: string | undefined, fallback: number): number => {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const loadConfig = () => {
  const configPath = path.resolve(__dirname, './assets/config.yaml');
  const configFile = fs.readFileSync(configPath, 'utf8');
  const configData = yaml.load(configFile) as LeadTrackerConfigType;
  const searchConfig = configData.leadDiscovery?.search;
  const ollamaConfig = configData.ollama;
  const remoteOkConfig = configData.leadDiscovery?.remoteOk;
  const himalayasConfig = configData.leadDiscovery?.himalayas;
  const weWorkRemotelyConfig = configData.leadDiscovery?.weWorkRemotely;
  const justRemoteConfig = configData.leadDiscovery?.justRemote;
  const jobicyConfig = configData.leadDiscovery?.jobicy;
  const clutchConfig = configData.leadDiscovery?.clutch;
  const crunchbaseConfig = configData.leadDiscovery?.crunchbase;
  const indeedConfig = configData.leadDiscovery?.indeed;
  const googleMapsConfig = configData.leadDiscovery?.googleMaps;

  return {
    ...configData,
    ollama: {
      host: process.env.OLLAMA_HOST || ollamaConfig?.host || 'prompt-proxy',
      port: toNumber(process.env.OLLAMA_PORT, ollamaConfig?.port ?? 11434),
      model: process.env.OLLAMA_MODEL || ollamaConfig?.model || 'gemma3',
      temperature: toNumber(
        process.env.OLLAMA_TEMPERATURE,
        ollamaConfig?.temperature ?? 0.3
      ),
      timeoutMs: toNumber(
        process.env.OLLAMA_TIMEOUT_MS,
        ollamaConfig?.timeoutMs ?? 120000
      ),
    },
    database: {
      ...configData.database,
      database:
        process.env.POSTGRES_DB ||
        configData.database.database ||
        configData.database.name,
      name:
        process.env.POSTGRES_DB ||
        configData.database.database ||
        configData.database.name,
      password: process.env.POSTGRES_PASSWORD || configData.database.password,
      username: process.env.POSTGRES_USER || configData.database.username,
    },
    leadDiscovery: {
      search: {
        enabled: toBoolean(
          process.env.LEAD_DISCOVERY_SEARCH_ENABLED,
          searchConfig?.enabled ?? true
        ),
        provider:
          process.env.LEAD_DISCOVERY_SEARCH_PROVIDER ||
          searchConfig?.provider ||
          'google-html',
        requestTimeoutMs: toNumber(
          process.env.LEAD_DISCOVERY_SEARCH_REQUEST_TIMEOUT_MS,
          searchConfig?.requestTimeoutMs ?? 5000
        ),
        userAgent:
          process.env.LEAD_DISCOVERY_SEARCH_USER_AGENT ||
          searchConfig?.userAgent ||
          'OptimisticTanukiLeadDiscovery/1.0',
        maxResultsPerQuery: toNumber(
          process.env.LEAD_DISCOVERY_SEARCH_MAX_RESULTS_PER_QUERY,
          searchConfig?.maxResultsPerQuery ?? 8
        ),
        maxQueriesPerProvider: toNumber(
          process.env.LEAD_DISCOVERY_SEARCH_MAX_QUERIES_PER_PROVIDER,
          searchConfig?.maxQueriesPerProvider ?? 6
        ),
        googleApiKey:
          process.env.LEAD_DISCOVERY_SEARCH_GOOGLE_API_KEY ||
          searchConfig?.googleApiKey,
        googleCx:
          process.env.LEAD_DISCOVERY_SEARCH_GOOGLE_CX || searchConfig?.googleCx,
        locale:
          process.env.LEAD_DISCOVERY_SEARCH_LOCALE ||
          searchConfig?.locale ||
          'en-US',
      },
      remoteOk: {
        enabled: toBoolean(
          process.env.LEAD_DISCOVERY_REMOTE_OK_ENABLED,
          remoteOkConfig?.enabled ?? true
        ),
      },
      himalayas: {
        enabled: toBoolean(
          process.env.LEAD_DISCOVERY_HIMALAYAS_ENABLED,
          himalayasConfig?.enabled ?? true
        ),
      },
      weWorkRemotely: {
        enabled: toBoolean(
          process.env.LEAD_DISCOVERY_WE_WORK_REMOTELY_ENABLED,
          weWorkRemotelyConfig?.enabled ?? true
        ),
      },
      justRemote: {
        enabled: toBoolean(
          process.env.LEAD_DISCOVERY_JUST_REMOTE_ENABLED,
          justRemoteConfig?.enabled ?? true
        ),
      },
      jobicy: {
        enabled: toBoolean(
          process.env.LEAD_DISCOVERY_JOBICY_ENABLED,
          jobicyConfig?.enabled ?? true
        ),
      },
      clutch: {
        enabled: toBoolean(
          process.env.LEAD_DISCOVERY_CLUTCH_ENABLED,
          clutchConfig?.enabled ?? true
        ),
      },
      crunchbase: {
        enabled: toBoolean(
          process.env.LEAD_DISCOVERY_CRUNCHBASE_ENABLED,
          crunchbaseConfig?.enabled ?? true
        ),
      },
      indeed: {
        enabled: toBoolean(
          process.env.LEAD_DISCOVERY_INDEED_ENABLED,
          indeedConfig?.enabled ?? true
        ),
      },
      googleMaps: {
        enabled: toBoolean(
          process.env.LEAD_DISCOVERY_GOOGLE_MAPS_ENABLED,
          googleMapsConfig?.enabled ?? true
        ),
        apiKey:
          process.env.GOOGLE_MAPS_API_KEY ||
          process.env.LEAD_DISCOVERY_GOOGLE_MAPS_API_KEY ||
          googleMapsConfig?.apiKey,
        textSearchUrl:
          process.env.LEAD_DISCOVERY_GOOGLE_MAPS_TEXT_SEARCH_URL ||
          googleMapsConfig?.textSearchUrl ||
          'https://maps.googleapis.com/maps/api/place/textsearch/json',
        autocompleteUrl:
          process.env.LEAD_DISCOVERY_GOOGLE_MAPS_AUTOCOMPLETE_URL ||
          googleMapsConfig?.autocompleteUrl ||
          'https://places.googleapis.com/v1/places:autocomplete',
        maxResults: toNumber(
          process.env.LEAD_DISCOVERY_GOOGLE_MAPS_MAX_RESULTS,
          googleMapsConfig?.maxResults ?? 10
        ),
      },
    },
  };
};

export default loadConfig;
