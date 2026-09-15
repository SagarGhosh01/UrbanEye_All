import * as ort from 'onnxruntime-web';

/**
 * Browser-side road defect detection.
 *
 * Runs the exact ONNX model that ships inside the Android app, compiled to WebAssembly.
 * The dashboard's camera view and the phone therefore produce the same detections from
 * the same weights — the browser path is not a simulation or a lookalike heuristic.
 *
 * This replaces a dark-pixel thresholder that assigned confidences from a fixed array
 * and, when it found nothing, drew a pothole in the middle of the frame regardless of
 * what the camera was pointed at.
 *
 * Contract mirrors OnnxRoadDefectDetector.kt exactly:
 *   input   [1, 3, 320, 320] FP32, CHW, normalised to [0, 1]
 *   output  [1, 4 + nc, anchors]  (or the transposed layout — both are handled)
 *   NMS     applied here at IoU 0.45, as in the Kotlin decoder
 */

const MODEL_URL = '/api/models/road-defect.onnx';
const INPUT_SIZE = 320;
const NUM_CLASSES = 7;
const IOU_THRESHOLD = 0.45;

/** Index order is fixed by the model export. Must match the Kotlin `when` block. */
export const MODEL_CLASSES = [
  'LONGITUDINAL_CRACK',   // D00
  'TRANSVERSE_CRACK',     // D10
  'ALLIGATOR_CRACK',      // D20
  'POTHOLE',              // D40
  'FADED_ZEBRA_CROSSING', // D43
  'FADED_LANE_MARKING',   // D44
  'UTILITY_COVER',        // D50
] as const;

export interface EdgeDetection {
  type: string;
  confidence: number;
  /** Normalised [0,1] box in the source frame. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Perspective estimate, cavity-type defects only. Null when not applicable. */
  estimatedDiameterCm: number | null;
}

let sessionPromise: Promise<ort.InferenceSession> | null = null;

/** Loads the model once and reuses it. Safe to call on every frame. */
export function loadEdgeModel(): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    // Serve the runtime from our own origin rather than a CDN, so the demo works on a
    // laptop with no internet. `npm run copy:ort` vendors these out of node_modules.
    ort.env.wasm.wasmPaths = '/ort/';
    ort.env.wasm.numThreads = 1;      // avoids requiring cross-origin isolation headers
    ort.env.wasm.simd = true;
    sessionPromise = ort.InferenceSession.create(MODEL_URL, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    }).catch((err) => {
      sessionPromise = null;          // let a later attempt retry rather than caching failure
      throw err;
    });
  }
  return sessionPromise;
}

/**
 * Only the lower part of the frame is road surface. Mirrors SanityFilter.kt, which
 * rejects candidates above the road plane so signage and sky cannot be read as defects.
 */
function isOnRoadSurface(yCentre: number): boolean {
  return yCentre >= 0.35;
}

/**
 * Ground size from the bounding box, using the same perspective scale factor as the
 * Kotlin detector so both runtimes report the same figure for the same view.
 *
 * This is an estimate from apparent size, not a measurement — and there is deliberately
 * no depth here, because a single camera cannot recover it.
 */
function estimateDiameterCm(w: number, h: number): number {
  const groundScale = Math.sqrt(w * h * 1.35);
  return Math.min(115, Math.max(18, Math.floor(groundScale * 175)));
}

function iou(a: EdgeDetection, b: EdgeDetection): number {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.w, b.x + b.w);
  const bottom = Math.min(a.y + a.h, b.y + b.h);
  if (right <= left || bottom <= top) return 0;
  const intersection = (right - left) * (bottom - top);
  const union = a.w * a.h + b.w * b.h - intersection;
  return union <= 0 ? 0 : intersection / union;
}

function applyNms(candidates: EdgeDetection[]): EdgeDetection[] {
  const sorted = [...candidates].sort((p, q) => q.confidence - p.confidence);
  const kept: EdgeDetection[] = [];
  while (sorted.length > 0) {
    const best = sorted.shift()!;
    kept.push(best);
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i].type === best.type && iou(best, sorted[i]) > IOU_THRESHOLD) {
        sorted.splice(i, 1);
      }
    }
  }
  return kept;
}

/** Draws the frame to 320x320 and produces a CHW float tensor normalised to [0,1]. */
function frameToTensor(source: CanvasImageSource): ort.Tensor {
  const canvas = document.createElement('canvas');
  canvas.width = INPUT_SIZE;
  canvas.height = INPUT_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, INPUT_SIZE, INPUT_SIZE);
  const { data } = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);

  const pixelCount = INPUT_SIZE * INPUT_SIZE;
  const chw = new Float32Array(pixelCount * 3);
  for (let i = 0; i < pixelCount; i++) {
    chw[i] = data[i * 4] / 255;                      // R plane
    chw[pixelCount + i] = data[i * 4 + 1] / 255;     // G plane
    chw[pixelCount * 2 + i] = data[i * 4 + 2] / 255; // B plane
  }
  return new ort.Tensor('float32', chw, [1, 3, INPUT_SIZE, INPUT_SIZE]);
}

export function decodeOutput(raw: Float32Array, dims: readonly number[], confidenceThreshold: number): EdgeDetection[] {
  const rows = 4 + NUM_CLASSES;
  // [1, 11, anchors] vs [1, anchors, 11]
  const transposed = dims[1] === rows;
  const anchors = transposed ? dims[2] : dims[1];
  const at = (row: number, anchor: number) => (transposed ? raw[row * anchors + anchor] : raw[anchor * rows + row]);

  const candidates: EdgeDetection[] = [];

  for (let anchor = 0; anchor < anchors; anchor++) {
    let bestScore = 0;
    let bestClass = -1;
    for (let c = 0; c < NUM_CLASSES; c++) {
      const score = at(4 + c, anchor);
      if (score > bestScore) {
        bestScore = score;
        bestClass = c;
      }
    }
    if (bestScore < confidenceThreshold || bestClass < 0) continue;

    // Model emits box centre and size in input-pixel units.
    const cx = at(0, anchor) / INPUT_SIZE;
    const cy = at(1, anchor) / INPUT_SIZE;
    const w = at(2, anchor) / INPUT_SIZE;
    const h = at(3, anchor) / INPUT_SIZE;
    if (!isOnRoadSurface(cy)) continue;

    const x = Math.max(0, Math.min(0.98, cx - w / 2));
    const y = Math.max(0, Math.min(0.98, cy - h / 2));
    const clampedW = Math.max(0.02, Math.min(1 - x, w));
    const clampedH = Math.max(0.02, Math.min(1 - y, h));

    const type = MODEL_CLASSES[bestClass];
    const isCavity = type === 'POTHOLE' || type === 'UTILITY_COVER';

    candidates.push({
      type,
      confidence: bestScore,
      x,
      y,
      w: clampedW,
      h: clampedH,
      estimatedDiameterCm: isCavity ? estimateDiameterCm(clampedW, clampedH) : null,
    });
  }

  return applyNms(candidates);
}

/**
 * Runs one frame through the model.
 * Returns an empty array when nothing is detected — which is a valid, common result.
 */
export async function detectFrame(
  source: CanvasImageSource,
  confidenceThreshold = 0.25
): Promise<EdgeDetection[]> {
  const session = await loadEdgeModel();
  const tensor = frameToTensor(source);
  const feeds: Record<string, ort.Tensor> = { [session.inputNames[0]]: tensor };
  const results = await session.run(feeds);
  const output = results[session.outputNames[0]];
  return decodeOutput(output.data as Float32Array, output.dims, confidenceThreshold);
}
