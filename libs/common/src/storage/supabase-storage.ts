import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Supabase Storage is not configured (`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are empty). */
export class StorageNotConfiguredError extends Error {
  constructor() {
    super('Supabase Storage is not configured');
  }
}

/** Supabase Storage refused or failed a request. */
export class StorageRequestError extends Error {
  constructor(
    readonly status: number,
    detail: string,
  ) {
    super(`Supabase Storage responded ${status}: ${detail}`);
  }
}

export type BucketOptions = { maxBytes: number; allowedTypes: readonly string[] };

/**
 * A small client for Supabase Storage's REST API, for one public bucket. It uses the
 * service-role key, so it must only run on the server. Images are served from the bucket's
 * public URL (no signed links), so a stored link keeps working until the object is removed.
 */
@Injectable()
export class SupabaseStorage {
  private readonly logger = new Logger(SupabaseStorage.name);
  private readonly baseUrl: string;
  private readonly key: string;
  readonly bucket: string;
  private bucketReady?: Promise<void>;

  constructor(config: ConfigService) {
    this.baseUrl = String(config.get('SUPABASE_URL') ?? '').replace(/\/+$/, '');
    this.key = String(config.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    this.bucket = String(config.get('SUPABASE_BUCKET') ?? 'heritage-sites');
  }

  get configured(): boolean {
    return this.baseUrl !== '' && this.key !== '';
  }

  /** The link anyone can open the object at. */
  publicUrl(path: string): string {
    return `${this.publicPrefix()}${encodePath(path)}`;
  }

  /** The object path behind one of our public links, or null for any other link (e.g. a path of the frontend). */
  pathFromPublicUrl(url: string): string | null {
    if (!this.configured || !url.startsWith(this.publicPrefix())) return null;
    const path = decodeURIComponent(url.slice(this.publicPrefix().length).split(/[?#]/)[0] ?? '');
    return path === '' ? null : path;
  }

  /** Creates the public bucket (with its own size and type limits) the first time, then does nothing. */
  ensureBucket(options: BucketOptions): Promise<void> {
    this.bucketReady ??= this.createBucket(options).catch((error: unknown) => {
      this.bucketReady = undefined; // try again on the next upload
      throw error;
    });
    return this.bucketReady;
  }

  /** Stores `body` at `path` (never overwriting) and returns its public link. */
  async upload(path: string, body: Uint8Array, contentType: string): Promise<string> {
    const response = await this.request(`/object/${this.bucket}/${encodePath(path)}`, {
      method: 'POST',
      headers: { 'content-type': contentType, 'cache-control': 'max-age=31536000', 'x-upsert': 'false' },
      body: body as BodyInit,
    });
    if (!response.ok) throw new StorageRequestError(response.status, await response.text());
    return this.publicUrl(path);
  }

  /** Deletes objects. Best effort: a failure is logged, never thrown, because the data change already happened. */
  async remove(paths: string[]): Promise<void> {
    if (!this.configured || paths.length === 0) return;
    try {
      const response = await this.request(`/object/${this.bucket}`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prefixes: paths }),
      });
      if (!response.ok) this.logger.warn(`Could not delete ${paths.length} image(s): ${response.status}`);
    } catch (error) {
      this.logger.warn(`Could not delete ${paths.length} image(s): ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Legacy `service_role` keys are JWTs and go in both headers. The newer `sb_secret_...` keys are not JWTs:
   * they go in `apikey` only, and the gateway turns them into a JWT itself.
   */
  private authHeaders(): Record<string, string> {
    return this.key.startsWith('sb_')
      ? { apikey: this.key }
      : { authorization: `Bearer ${this.key}`, apikey: this.key };
  }

  private publicPrefix(): string {
    return `${this.baseUrl}/storage/v1/object/public/${this.bucket}/`;
  }

  private async createBucket({ maxBytes, allowedTypes }: BucketOptions): Promise<void> {
    const response = await this.request('/bucket', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: this.bucket,
        name: this.bucket,
        public: true,
        file_size_limit: maxBytes,
        allowed_mime_types: allowedTypes,
      }),
    });
    if (response.ok) return;

    const detail = await response.text();
    // Supabase answers "already exists" with a 409 (sometimes wrapped in a 400).
    if (response.status === 409 || /already exists|duplicate/i.test(detail)) return;
    throw new StorageRequestError(response.status, detail);
  }

  private request(route: string, init: RequestInit): Promise<Response> {
    if (!this.configured) throw new StorageNotConfiguredError();
    return fetch(`${this.baseUrl}/storage/v1${route}`, {
      ...init,
      headers: { ...this.authHeaders(), ...init.headers },
      signal: AbortSignal.timeout(15_000),
    });
  }
}

const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');
