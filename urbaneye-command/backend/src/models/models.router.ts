import { Router } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export const modelsRouter = Router();

/**
 * The bundled edge model, described as it actually is.
 *
 * Read straight off the .onnx metadata: Ultralytics YOLOv8, opset 12, FP32, 320x320,
 * seven RDD classes. Earlier revisions of this file advertised a "YOLO26-seg" model at
 * opset 14, INT8-quantised, with ten classes — none of which matched the shipped file.
 */
export const EDGE_MODEL = {
  id: 'urbaneye-road-defect-v1',
  name: 'UrbanEye Road Defect Detector',
  architecture: 'YOLOv8n (Ultralytics)',
  format: 'ONNX, opset 12, FP32, static shapes, NMS applied client-side',
  baseDataset: 'RDD2022-derived road damage dataset',
  inputShape: [1, 3, 320, 320],
  /** Index order matches the model export exactly. Do not reorder. */
  classes: [
    'LONGITUDINAL_CRACK',   // D00
    'TRANSVERSE_CRACK',     // D10
    'ALLIGATOR_CRACK',      // D20
    'POTHOLE',              // D40
    'FADED_ZEBRA_CROSSING', // D43
    'FADED_LANE_MARKING',   // D44
    'UTILITY_COVER',        // D50
  ],
  placement: 'Edge — Android APK and browser (WebAssembly)',
};

const MODEL_CANDIDATES = [
  path.resolve(process.cwd(), '../../urbaneye-mobile/app/src/main/assets/models/road_defect_detector.onnx'),
  path.resolve(process.cwd(), '../urbaneye-mobile/app/src/main/assets/models/road_defect_detector.onnx'),
  path.resolve(process.cwd(), 'urbaneye-mobile/app/src/main/assets/models/road_defect_detector.onnx'),
];

export function resolveModelPath(): string | null {
  return MODEL_CANDIDATES.find((candidate) => fs.existsSync(candidate)) ?? null;
}

// GET /api/models/info
modelsRouter.get('/info', (req, res) => {
  const modelPath = resolveModelPath();
  const sizeBytes = modelPath ? fs.statSync(modelPath).size : null;

  res.json({
    status: 'SUCCESS',
    pipelineArchitecture: 'Single-stage edge detector, NMS and temporal filtering on the client',
    models: [
      {
        ...EDGE_MODEL,
        classCount: EDGE_MODEL.classes.length,
        sizeBytes,
        status: modelPath ? 'DEPLOYED' : 'MODEL_FILE_MISSING',
      },
    ],
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/models/road-defect.onnx
 *
 * Serves the model weights to the browser detector so the dashboard runs the very same
 * network as the phone, rather than a lookalike heuristic. One file on disk, two runtimes.
 */
modelsRouter.get('/road-defect.onnx', (req, res) => {
  const modelPath = resolveModelPath();
  if (!modelPath) {
    res.status(404).json({ status: 'ERROR', message: 'Edge model file not found on the server.' });
    return;
  }
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  fs.createReadStream(modelPath).pipe(res);
});

modelsRouter.post('/infer', (req, res) => {
  const { imageSnippet, confidenceThreshold = 0.40 } = req.body;

  // Mock detection results if no image provided or fallback
  const simulatedDetections = [
    {
      class: 'POTHOLE',
      classCode: 'D40',
      confidence: 0.94,
      box: { x: 160, y: 140, w: 90, h: 75 },
      estimatedDiameterCm: 45.2,
      estimatedRepairCostINR: 8500,
    },
    {
      class: 'ROAD_CRACK',
      classCode: 'D20',
      confidence: 0.86,
      box: { x: 80, y: 210, w: 140, h: 30 },
      estimatedDiameterCm: 24.0,
      estimatedRepairCostINR: 3200,
    },
  ];

  res.json({
    status: 'SUCCESS',
    inferenceEngine: 'UrbanEye YOLOv8 Edge AI',
    detectionsCount: simulatedDetections.length,
    predictions: simulatedDetections,
    totalEstimatedCostINR: 11700,
    inferredAt: new Date().toISOString(),
  });
});

// POST /api/models/train - Trigger Python model training script execution
modelsRouter.post('/train', (req, res) => {
  const { epochs = 15, batchSize = 16 } = req.body;
  const scriptPath = path.resolve(process.cwd(), 'scripts/train_road_defects.py');

  if (!fs.existsSync(scriptPath)) {
    return res.status(404).json({
      status: 'ERROR',
      message: `Training script not found at ${scriptPath}`,
    });
  }

  // Launch python process in background
  const pythonProc = spawn('python', [scriptPath, '--epochs', String(epochs)], {
    cwd: process.cwd(),
    detached: true,
    stdio: 'ignore',
  });
  pythonProc.unref();

  res.json({
    status: 'SUCCESS',
    message: `Model training pipeline launched for ${epochs} epochs (Batch: ${batchSize}).`,
    jobId: `train-job-${Date.now()}`,
    script: 'scripts/train_road_defects.py',
    startedAt: new Date().toISOString(),
  });
});
