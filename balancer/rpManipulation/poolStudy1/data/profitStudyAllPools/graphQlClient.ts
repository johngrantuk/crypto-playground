import fetch from 'isomorphic-fetch';
import { PROFIT_STUDY_ALL_POOLS } from './config';

type GraphQLError = { message: string };
type GraphQLResponse<T> = {
    data?: T;
    errors?: GraphQLError[];
};

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(body: string, headerValue: string | null): number | null {
    if (headerValue) {
        const sec = Number(headerValue);
        if (Number.isFinite(sec) && sec > 0) {
            return Math.round(sec * 1000);
        }
    }
    try {
        const parsed = JSON.parse(body) as { retry_after?: unknown };
        const sec = Number(parsed.retry_after);
        if (Number.isFinite(sec) && sec > 0) {
            return Math.round(sec * 1000);
        }
    } catch (_err) {
        // Ignore malformed/non-JSON bodies.
    }
    return null;
}

export async function graphQlRequest<T>(
    query: string,
    variables?: Record<string, unknown>
): Promise<T> {
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= PROFIT_STUDY_ALL_POOLS.maxRequestRetries) {
        try {
            const response = await fetch(PROFIT_STUDY_ALL_POOLS.apiEndpoint, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query, variables }),
            });

            if (!response.ok) {
                const body = await response.text();
                const isRetryable =
                    response.status === 429 ||
                    response.status === 408 ||
                    response.status === 425 ||
                    (response.status >= 500 && response.status < 600);
                if (!isRetryable) {
                    throw new Error(
                        `API request failed with status ${response.status}: ${body}`
                    );
                }
                const retryAfterMs = parseRetryAfterMs(
                    body,
                    response.headers.get('retry-after')
                );
                const expBackoff = Math.min(
                    PROFIT_STUDY_ALL_POOLS.retryBaseDelayMs * 2 ** attempt,
                    PROFIT_STUDY_ALL_POOLS.retryMaxDelayMs
                );
                const jitter = Math.floor(Math.random() * 400);
                const waitMs = Math.max(retryAfterMs ?? 0, expBackoff) + jitter;
                lastError = new Error(
                    `API request failed with status ${response.status}: ${body}`
                );
                if (attempt >= PROFIT_STUDY_ALL_POOLS.maxRequestRetries) {
                    break;
                }
                console.warn(
                    `[graphql retry] status=${response.status}, attempt=${attempt + 1}/${PROFIT_STUDY_ALL_POOLS.maxRequestRetries}, waitMs=${waitMs}`
                );
                await sleep(waitMs);
                attempt += 1;
                continue;
            }

            const result: GraphQLResponse<T> = await response.json();
            if (result.errors && result.errors.length > 0) {
                throw new Error(result.errors.map((e) => e.message).join('; '));
            }
            if (!result.data) {
                throw new Error('GraphQL response missing data');
            }
            return result.data;
        } catch (err) {
            lastError =
                err instanceof Error ? err : new Error('Unknown GraphQL error');
            if (attempt >= PROFIT_STUDY_ALL_POOLS.maxRequestRetries) {
                break;
            }
            const expBackoff = Math.min(
                PROFIT_STUDY_ALL_POOLS.retryBaseDelayMs * 2 ** attempt,
                PROFIT_STUDY_ALL_POOLS.retryMaxDelayMs
            );
            const jitter = Math.floor(Math.random() * 400);
            const waitMs = expBackoff + jitter;
            console.warn(
                `[graphql retry] error=${lastError.message}, attempt=${attempt + 1}/${PROFIT_STUDY_ALL_POOLS.maxRequestRetries}, waitMs=${waitMs}`
            );
            await sleep(waitMs);
            attempt += 1;
        }
    }
    throw lastError ?? new Error('GraphQL request failed after retries');
}

export async function graphQlRequestWithDelay<T>(
    query: string,
    variables?: Record<string, unknown>
): Promise<T> {
    const delay = PROFIT_STUDY_ALL_POOLS.requestDelayMs;
    if (delay > 0) {
        await new Promise((r) => setTimeout(r, delay));
    }
    return graphQlRequest<T>(query, variables);
}
