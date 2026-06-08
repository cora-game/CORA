const DEFAULT_CHALLENGE_PATH = "/lobby";

type CreateChallengeLinkOptions = {
  origin: string | null;
  arenaId: string;
  token: string;
  wagerUsd: string;
  refAddress?: string | null;
  pathname?: string;
};

function normalize(value: string | null | undefined) {
  return (value ?? "").trim();
}

export function createChallengeLink({
  origin,
  arenaId,
  token,
  wagerUsd,
  refAddress,
  pathname = DEFAULT_CHALLENGE_PATH,
}: CreateChallengeLinkOptions): string | null {
  const safeOrigin = normalize(origin);
  if (!safeOrigin) return null;

  const url = new URL(pathname, safeOrigin);
  url.searchParams.set("challenge", "1");
  url.searchParams.set("arena", normalize(arenaId).toLowerCase());
  url.searchParams.set("token", normalize(token).toUpperCase());
  url.searchParams.set("wager", normalize(wagerUsd));

  const safeRef = normalize(refAddress);
  if (safeRef) {
    url.searchParams.set("ref", safeRef);
  }

  return url.toString();
}

export function createChallengeTweetIntent(shareLink: string, text = "Challenge me in CORA.") {
  const tweet = new URL("https://x.com/intent/tweet");
  tweet.searchParams.set("text", text);
  tweet.searchParams.set("url", shareLink);
  return tweet.toString();
}
