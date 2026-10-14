import { handleKeyDownload } from '@/lib/mediaDownload';

/**
 * Download by catalogue key, e.g. `/api/media/download?key=movie:969681`.
 *
 * Split from the streaming route so the two concerns stay separate: this one
 * always sends an attachment with a friendly filename, while the parent streams
 * for playback with range support.
 */
export async function GET(request: Request) {
  return handleKeyDownload(request);
}