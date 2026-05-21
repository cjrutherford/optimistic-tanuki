type ProviderJsonReadResult<T> =
  | { ok: true; payload: T; warning?: undefined }
  | { ok: false; warning: string; payload?: undefined };

const readContentType = (response: Response): string => {
  return response.headers.get('content-type') || 'unknown';
};

const buildBodyPreview = (body: string): string => {
  const preview = body.replace(/\s+/g, ' ').trim().slice(0, 160);
  return preview ? ` Preview: ${preview}` : '';
};

export const readJsonResponse = async <T>(
  response: Response,
  providerName: string
): Promise<ProviderJsonReadResult<T>> => {
  const contentType = readContentType(response);
  const body = await response.text();

  if (!response.ok) {
    return {
      ok: false,
      warning: `${providerName} request failed with HTTP ${response.status}. Expected JSON but received ${contentType}.${buildBodyPreview(body)}`,
    };
  }

  if (!/application\/json/i.test(contentType)) {
    return {
      ok: false,
      warning: `${providerName} request failed. Expected JSON but received ${contentType}.${buildBodyPreview(body)}`,
    };
  }

  try {
    return {
      ok: true,
      payload: JSON.parse(body) as T,
    };
  } catch (error) {
    return {
      ok: false,
      warning: `${providerName} returned invalid JSON: ${error instanceof Error ? error.message : 'Unknown parse error'}.${buildBodyPreview(body)}`,
    };
  }
};
