import {
  idbAll,
  idbDelete,
  idbGet,
  idbPut,
  type SoundRecord,
} from "@/lib/persist/idb";
import { newId } from "@/lib/util/id";

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
export const MAX_UPLOAD_SECONDS = 5;

export class SoundImportError extends Error {}

/** Decoded buffers, keyed by asset id. */
const bufferCache = new Map<string, AudioBuffer>();
const broken = new Set<string>();

/**
 * Decode with both Safari workarounds.
 *
 * 1. decodeAudioData DETACHES its input ArrayBuffer. Hand it a slice, or the
 *    copy you go on to store becomes a zero-length husk — this is the number
 *    one cause of "it worked once, then was silent after reload".
 *
 * 2. Safari's promise form rejects some perfectly valid VBR MP3s that its own
 *    legacy callback form decodes fine. Three lines to try both.
 */
export function decodeAudio(
  ctx: BaseAudioContext,
  data: ArrayBuffer,
): Promise<AudioBuffer> {
  return ctx.decodeAudioData(data.slice(0)).catch(
    () =>
      new Promise<AudioBuffer>((resolve, reject) => {
        ctx.decodeAudioData(data.slice(0), resolve, reject);
      }),
  );
}

export async function importSound(
  file: File,
  ctx: BaseAudioContext,
): Promise<SoundRecord> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new SoundImportError("That file is over 2 MB. Please pick a shorter clip.");
  }

  const bytes = await file.arrayBuffer();

  let buffer: AudioBuffer;
  try {
    buffer = await decodeAudio(ctx, bytes);
  } catch {
    throw new SoundImportError(
      "Could not read that audio file. Try a WAV, M4A/AAC or MP3 — OGG files don't work on iPhone.",
    );
  }

  if (buffer.duration > MAX_UPLOAD_SECONDS) {
    throw new SoundImportError(
      `That clip is ${buffer.duration.toFixed(1)}s. Please pick one under ${MAX_UPLOAD_SECONDS}s.`,
    );
  }

  const record: SoundRecord = {
    id: newId(),
    name: file.name,
    mime: file.type || "audio/*",
    // Store the Blob rather than the ArrayBuffer — WebKit disk-backs Blobs
    // instead of holding them in memory inside the IDB value.
    blob: new Blob([bytes], { type: file.type || "audio/*" }),
    size: file.size,
    createdAt: Date.now(),
  };

  // Only persist after a successful decode, so a file that can't be played
  // never becomes the configured alarm.
  await idbPut(record);
  bufferCache.set(record.id, buffer);
  broken.delete(record.id);

  return record;
}

export function getCachedBuffer(assetId: string): AudioBuffer | null {
  return bufferCache.get(assetId) ?? null;
}

export function isBroken(assetId: string): boolean {
  return broken.has(assetId);
}

/**
 * Re-decode a stored sound. Returns null if it can't be loaded, in which case
 * callers fall back to the synth preset — the timer must never end up with a
 * silent alarm.
 */
export async function loadSound(
  assetId: string,
  ctx: BaseAudioContext,
): Promise<AudioBuffer | null> {
  const cached = bufferCache.get(assetId);
  if (cached) return cached;
  if (broken.has(assetId)) return null;

  const record = await idbGet(assetId);
  if (!record) {
    broken.add(assetId);
    return null;
  }

  try {
    const bytes = await record.blob.arrayBuffer();
    const buffer = await decodeAudio(ctx, bytes);
    bufferCache.set(assetId, buffer);
    return buffer;
  } catch {
    broken.add(assetId);
    return null;
  }
}

export async function deleteSound(assetId: string): Promise<void> {
  bufferCache.delete(assetId);
  broken.delete(assetId);
  await idbDelete(assetId);
}

export function listSounds(): Promise<SoundRecord[]> {
  return idbAll();
}
