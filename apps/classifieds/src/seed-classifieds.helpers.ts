type CommunityResponse = {
  id: string;
};

export async function parseCommunityLookupResponse(
  response: Response
): Promise<string | null> {
  if (!response.ok) {
    return null;
  }

  const body = await response.text();
  if (!body.trim()) {
    return null;
  }

  try {
    const community = JSON.parse(body) as Partial<CommunityResponse>;
    return typeof community.id === 'string' && community.id.length > 0
      ? community.id
      : null;
  } catch {
    return null;
  }
}
