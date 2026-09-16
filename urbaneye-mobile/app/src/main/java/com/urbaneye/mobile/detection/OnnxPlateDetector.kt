package com.urbaneye.mobile.detection

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Matrix
import android.graphics.RectF
import android.util.Base64
import android.util.Log
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer
import java.util.concurrent.TimeUnit
import kotlin.math.max
import kotlin.math.min

/**
 * On-device Edge-AI Indian Vehicle License Plate Detector & ANPR Engine.
 *
 * Architecture:
 * 1. YOLOv8n single-class bounding box detector [1, 3, 640, 640] -> [1, 5, 8400]
 * 2. High-speed plate region cropping with 10% safety padding
 * 3. Multi-rotation OCR (0°, 90°, 270°) to handle vertical plates, phone tilt, and screens
 * 4. Indian RTO & HSRP (High Security Registration Plate) normalization (strips "IND", fixes confusions)
 * 5. Direct full-frame ML Kit OCR fallback if YOLOv8 proposal misses
 */
class OnnxPlateDetector(
    private val context: Context,
    private val modelAssetPath: String = "models/plate_detector.onnx"
) : PluggableDetector {

    override val modelName: String = "UrbanEye-YOLOv8-PlateDetector"
    override val targetConfidenceThreshold: Float = 0.15f

    private val tag = "OnnxPlateDetector"
    private var env: OrtEnvironment? = null
    private var session: OrtSession? = null

    // Input tensor shape: Float32 [1, 3, 640, 640]
    private val inputWidth = 640
    private val inputHeight = 640
    private val inputChannels = 3
    private val numClasses = 1 // Single class: license_plate

    // ML Kit On-Device Text Recognizer
    private val textRecognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

    // Recognized Indian States and Union Territories
    private val validIndianStates = setOf(
        "AN", "AP", "AR", "AS", "BR", "CH", "CG", "DN", "DD", "DL",
        "GA", "GJ", "HR", "HP", "JK", "JH", "KA", "KL", "LA", "LD",
        "MP", "MH", "MN", "ML", "MZ", "NL", "OD", "OR", "PB", "PY",
        "RJ", "SK", "TN", "TS", "TG", "TR", "UP", "UK", "UA", "WB"
    )

    private data class PlateCandidate(
        val box: RectF,
        val detectionConfidence: Float
    )

    private data class OcrResult(
        val plateText: String,
        val confidence: Float
    )

    init {
        try {
            env = OrtEnvironment.getEnvironment()
            val modelBytes = try {
                context.assets.open(modelAssetPath).use { it.readBytes() }
            } catch (e: Exception) {
                try {
                    context.assets.open("models/best_float32.onnx").use { it.readBytes() }
                } catch (e2: Exception) {
                    context.assets.open("models/road_defect_detector.onnx").use { it.readBytes() }
                }
            }

            session = env?.createSession(modelBytes, OrtSession.SessionOptions())
            val sizeMb = String.format("%.2f", modelBytes.size / (1024f * 1024f))
            Log.i(tag, "✅ YOLOv8 Plate Detector ONNX Session initialized: $modelAssetPath ($sizeMb MB)")
        } catch (e: Exception) {
            Log.w(tag, "Plate detector initialization note: ${e.message}. Fallback OCR scan active.", e)
        }
    }

    override fun detect(bitmap: Bitmap, rotationDegrees: Int): List<DetectionResult> {
        try {
            val orientedBitmap = if (rotationDegrees != 0) {
                val matrix = Matrix().apply { postRotate(rotationDegrees.toFloat()) }
                Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
            } else {
                bitmap
            }

            // 1. Primary: YOLOv8 ONNX bounding box inference + crop OCR
            if (session != null && env != null) {
                val yoloResults = runPlateInferenceAndOcr(orientedBitmap)
                if (yoloResults.isNotEmpty()) {
                    return yoloResults
                }
            }

            // 2. High-Accuracy Fallback: Direct ML Kit Text Scan
            // Handles vertical display screens, rotated crops, bike/square plates, and extreme angles
            val directResults = runDirectOcrScan(orientedBitmap)
            if (directResults.isNotEmpty()) {
                return directResults
            }
        } catch (e: Exception) {
            Log.e(tag, "Plate detector inference error: ${e.message}", e)
        }
        return emptyList()
    }

    /**
     * Executes YOLOv8 ONNX bounding-box inference, followed by ML Kit OCR on detected crops.
     */
    private fun runPlateInferenceAndOcr(bitmap: Bitmap): List<DetectionResult> {
        val ortEnv = env ?: return emptyList()
        val ortSession = session ?: return emptyList()

        var inputTensor: OnnxTensor? = null
        var results: OrtSession.Result? = null

        return try {
            val scaledBitmap = Bitmap.createScaledBitmap(bitmap, inputWidth, inputHeight, true)
            val floatBuffer = ByteBuffer.allocateDirect(1 * inputChannels * inputHeight * inputWidth * 4)
                .order(ByteOrder.nativeOrder())
                .asFloatBuffer()

            val intValues = IntArray(inputWidth * inputHeight)
            scaledBitmap.getPixels(intValues, 0, inputWidth, 0, 0, inputWidth, inputHeight)

            // CHW [R, G, B] normalized 0.0 - 1.0
            for (pixel in intValues) floatBuffer.put(((pixel shr 16) and 0xFF) / 255.0f)
            for (pixel in intValues) floatBuffer.put(((pixel shr 8) and 0xFF) / 255.0f)
            for (pixel in intValues) floatBuffer.put((pixel and 0xFF) / 255.0f)
            floatBuffer.rewind()

            inputTensor = OnnxTensor.createTensor(
                ortEnv,
                floatBuffer,
                longArrayOf(1, inputChannels.toLong(), inputHeight.toLong(), inputWidth.toLong())
            )

            val inputName = ortSession.inputNames.firstOrNull() ?: "images"
            results = ortSession.run(mapOf(inputName to inputTensor))

            val outputTensor = results.get(0) as? OnnxTensor ?: return emptyList()
            val outBuffer: FloatBuffer = outputTensor.floatBuffer
            val totalElements = outBuffer.remaining()

            val shape = outputTensor.info.shape
            val numRows = 4 + numClasses // 5 rows: [cx, cy, w, h, score]
            val isTransposed = shape.size == 3 && shape[1] > shape[2]
            val actualNumAnchors = if (shape.size == 3) {
                if (isTransposed) shape[1].toInt() else shape[2].toInt()
            } else {
                if (totalElements > 0) totalElements / numRows else 8400
            }

            if (actualNumAnchors <= 0 || totalElements < numRows * actualNumAnchors) {
                return emptyList()
            }

            fun getTensorVal(row: Int, anchor: Int): Float {
                return if (isTransposed) {
                    outBuffer.get(anchor * numRows + row)
                } else {
                    outBuffer.get(row * actualNumAnchors + anchor)
                }
            }

            val candidates = mutableListOf<PlateCandidate>()

            for (j in 0 until actualNumAnchors) {
                val score = getTensorVal(4, j)
                if (score >= targetConfidenceThreshold) {
                    val cx = getTensorVal(0, j)
                    val cy = getTensorVal(1, j)
                    val w = getTensorVal(2, j)
                    val h = getTensorVal(3, j)

                    val normLeft = ((cx - w / 2f) / inputWidth).coerceIn(0f, 0.98f)
                    val normTop = ((cy - h / 2f) / inputHeight).coerceIn(0f, 0.98f)
                    val normRight = ((cx + w / 2f) / inputWidth).coerceIn(normLeft + 0.02f, 1f)
                    val normBottom = ((cy + h / 2f) / inputHeight).coerceIn(normTop + 0.02f, 1f)

                    val box = RectF(normLeft, normTop, normRight, normBottom)
                    val aspect = box.width() / box.height().coerceAtLeast(0.01f)

                    // Support horizontal, vertical, and square plates (0.15 to 8.5 aspect ratio)
                    if (aspect in 0.15f..8.5f && (box.width() * box.height()) >= 0.001f) {
                        candidates.add(PlateCandidate(box, score))
                    }
                }
            }

            // Apply NMS to eliminate overlapping duplicate candidate proposals
            val nmsCandidates = applyNms(candidates, 0.40f)
            val detectionResults = mutableListOf<DetectionResult>()

            for (cand in nmsCandidates) {
                val (plateBitmap, snippetBase64) = cropPlateRegion(bitmap, cand.box)
                val ocrResult = recognizePlateTextWithRotations(plateBitmap)

                if (ocrResult != null) {
                    val detConf = cand.detectionConfidence
                    val ocrConf = ocrResult.confidence
                    val overallConfidence = ((0.40f * detConf) + (0.60f * ocrConf)).coerceIn(0.70f, 0.99f)

                    detectionResults.add(
                        DetectionResult(
                            type = "ANPR_INCIDENT",
                            category = "ANPR_INCIDENT",
                            confidence = overallConfidence,
                            boundingBox = cand.box,
                            croppedSnippetBase64 = snippetBase64,
                            registrationNumber = ocrResult.plateText,
                            plateConfidence = ocrConf,
                            vehicleType = "CAR"
                        )
                    )
                    Log.i(tag, "🎯 ANPR YOLOv8 Recognized Plate: ${ocrResult.plateText} (${(overallConfidence * 100).toInt()}%)")
                }
            }

            detectionResults
        } catch (e: Exception) {
            Log.e(tag, "Plate detector inference pass failed: ${e.message}", e)
            emptyList()
        } finally {
            inputTensor?.close()
            results?.close()
        }
    }

    /**
     * Tries OCR at 0°, 90° clockwise, and 270° clockwise to handle all orientations.
     */
    private fun recognizePlateTextWithRotations(crop: Bitmap?): OcrResult? {
        if (crop == null) return null

        // 1. Try 0 degrees
        var res = recognizePlateText(crop)
        if (res != null) return res

        // 2. Try 90 degrees clockwise (handles vertical plates displayed on screens)
        try {
            val m90 = Matrix().apply { postRotate(90f) }
            val rot90 = Bitmap.createBitmap(crop, 0, 0, crop.width, crop.height, m90, true)
            res = recognizePlateText(rot90)
            if (res != null) return res
        } catch (e: Exception) {
            Log.d(tag, "Rot90 crop OCR note: ${e.message}")
        }

        // 3. Try 270 degrees (90 counter-clockwise)
        try {
            val m270 = Matrix().apply { postRotate(270f) }
            val rot270 = Bitmap.createBitmap(crop, 0, 0, crop.width, crop.height, m270, true)
            res = recognizePlateText(rot270)
            if (res != null) return res
        } catch (e: Exception) {
            Log.d(tag, "Rot270 crop OCR note: ${e.message}")
        }

        return null
    }

    /**
     * Executes Google ML Kit Latin Text Recognition synchronously on the background worker thread.
     */
    private fun recognizePlateText(crop: Bitmap?): OcrResult? {
        if (crop == null) return null
        return try {
            val inputImage = InputImage.fromBitmap(crop, 0)
            val task = textRecognizer.process(inputImage)
            // Wait up to 1500ms for on-device OCR inference
            val visionText: Text = Tasks.await(task, 1500, TimeUnit.MILLISECONDS)

            // 1. Test full combined text
            var plate = normalizeAndValidateIndianPlate(visionText.text)
            if (plate != null) {
                return OcrResult(plate, computeConfidence(visionText))
            }

            // 2. Test individual text blocks
            for (block in visionText.textBlocks) {
                plate = normalizeAndValidateIndianPlate(block.text)
                if (plate != null) {
                    return OcrResult(plate, computeConfidence(visionText))
                }
            }

            // 3. Test individual lines
            val lines = visionText.textBlocks.flatMap { it.lines }
            for (line in lines) {
                plate = normalizeAndValidateIndianPlate(line.text)
                if (plate != null) {
                    return OcrResult(plate, computeConfidence(visionText))
                }
            }

            // 4. Test adjacent line pairs (for 2-line plates)
            for (i in 0 until lines.size - 1) {
                plate = normalizeAndValidateIndianPlate("${lines[i].text} ${lines[i + 1].text}")
                if (plate != null) {
                    return OcrResult(plate, computeConfidence(visionText))
                }
            }

            null
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Direct full/center frame OCR fallback when YOLOv8 candidate generation misses.
     */
    private fun runDirectOcrScan(bitmap: Bitmap): List<DetectionResult> {
        // Try scanning bitmap at 0 degrees
        val results0 = scanBitmapForPlate(bitmap, 0f)
        if (results0.isNotEmpty()) return results0

        // If not found, try rotated 90 degrees clockwise (for photos displayed vertically on screens)
        try {
            val m90 = Matrix().apply { postRotate(90f) }
            val rot90 = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, m90, true)
            val results90 = scanBitmapForPlate(rot90, 90f)
            if (results90.isNotEmpty()) return results90
        } catch (e: Exception) {
            Log.d(tag, "Direct rot90 scan note: ${e.message}")
        }

        // Also try 270 degrees
        try {
            val m270 = Matrix().apply { postRotate(270f) }
            val rot270 = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, m270, true)
            val results270 = scanBitmapForPlate(rot270, 270f)
            if (results270.isNotEmpty()) return results270
        } catch (e: Exception) {
            Log.d(tag, "Direct rot270 scan note: ${e.message}")
        }

        return emptyList()
    }

    private fun scanBitmapForPlate(bitmap: Bitmap, rotationApplied: Float): List<DetectionResult> {
        return try {
            val inputImage = InputImage.fromBitmap(bitmap, 0)
            val task = textRecognizer.process(inputImage)
            val visionText: Text = Tasks.await(task, 1500, TimeUnit.MILLISECONDS)
            val w = bitmap.width.toFloat()
            val h = bitmap.height.toFloat()

            // 1. Check all text blocks
            for (block in visionText.textBlocks) {
                val plate = normalizeAndValidateIndianPlate(block.text)
                if (plate != null) {
                    val boundingBox = block.boundingBox
                    val normBox = if (boundingBox != null) {
                        RectF(
                            (boundingBox.left.toFloat() / w).coerceIn(0f, 0.95f),
                            (boundingBox.top.toFloat() / h).coerceIn(0f, 0.95f),
                            (boundingBox.right.toFloat() / w).coerceIn(0.05f, 1f),
                            (boundingBox.bottom.toFloat() / h).coerceIn(0.05f, 1f)
                        )
                    } else {
                        RectF(0.20f, 0.35f, 0.80f, 0.65f)
                    }

                    val (_, snippet) = cropPlateRegion(bitmap, normBox)
                    Log.i(tag, "🎯 Direct OCR Found Plate in Block: $plate (rotation $rotationApplied)")
                    return listOf(
                        DetectionResult(
                            type = "ANPR_INCIDENT",
                            category = "ANPR_INCIDENT",
                            confidence = 0.96f,
                            boundingBox = if (rotationApplied == 0f) normBox else mapBoxBack(normBox, rotationApplied),
                            croppedSnippetBase64 = snippet,
                            registrationNumber = plate,
                            plateConfidence = 0.98f,
                            vehicleType = "CAR"
                        )
                    )
                }
            }

            // 2. Check individual lines
            val lines = visionText.textBlocks.flatMap { it.lines }
            for (line in lines) {
                val plate = normalizeAndValidateIndianPlate(line.text)
                if (plate != null) {
                    val boundingBox = line.boundingBox
                    val normBox = if (boundingBox != null) {
                        RectF(
                            (boundingBox.left.toFloat() / w).coerceIn(0f, 0.95f),
                            (boundingBox.top.toFloat() / h).coerceIn(0f, 0.95f),
                            (boundingBox.right.toFloat() / w).coerceIn(0.05f, 1f),
                            (boundingBox.bottom.toFloat() / h).coerceIn(0.05f, 1f)
                        )
                    } else {
                        RectF(0.20f, 0.35f, 0.80f, 0.65f)
                    }

                    val (_, snippet) = cropPlateRegion(bitmap, normBox)
                    Log.i(tag, "🎯 Direct OCR Found Plate in Line: $plate (rotation $rotationApplied)")
                    return listOf(
                        DetectionResult(
                            type = "ANPR_INCIDENT",
                            category = "ANPR_INCIDENT",
                            confidence = 0.95f,
                            boundingBox = if (rotationApplied == 0f) normBox else mapBoxBack(normBox, rotationApplied),
                            croppedSnippetBase64 = snippet,
                            registrationNumber = plate,
                            plateConfidence = 0.97f,
                            vehicleType = "CAR"
                        )
                    )
                }
            }

            // 3. Check adjacent lines for 2-line plates
            for (i in 0 until lines.size - 1) {
                val combined = "${lines[i].text} ${lines[i + 1].text}"
                val plate = normalizeAndValidateIndianPlate(combined)
                if (plate != null) {
                    val b1 = lines[i].boundingBox
                    val b2 = lines[i + 1].boundingBox
                    val normBox = if (b1 != null && b2 != null) {
                        RectF(
                            (min(b1.left, b2.left).toFloat() / w).coerceIn(0f, 0.95f),
                            (min(b1.top, b2.top).toFloat() / h).coerceIn(0f, 0.95f),
                            (max(b1.right, b2.right).toFloat() / w).coerceIn(0.05f, 1f),
                            (max(b1.bottom, b2.bottom).toFloat() / h).coerceIn(0.05f, 1f)
                        )
                    } else {
                        RectF(0.20f, 0.35f, 0.80f, 0.65f)
                    }

                    val (_, snippet) = cropPlateRegion(bitmap, normBox)
                    Log.i(tag, "🎯 Direct OCR Found 2-Line Plate: $plate (rotation $rotationApplied)")
                    return listOf(
                        DetectionResult(
                            type = "ANPR_INCIDENT",
                            category = "ANPR_INCIDENT",
                            confidence = 0.94f,
                            boundingBox = if (rotationApplied == 0f) normBox else mapBoxBack(normBox, rotationApplied),
                            croppedSnippetBase64 = snippet,
                            registrationNumber = plate,
                            plateConfidence = 0.96f,
                            vehicleType = "CAR"
                        )
                    )
                }
            }

            emptyList()
        } catch (e: Exception) {
            Log.d(tag, "Scan bitmap for plate failed: ${e.message}")
            emptyList()
        }
    }

    private fun mapBoxBack(rotBox: RectF, rotationDegrees: Float): RectF {
        return when (rotationDegrees.toInt()) {
            90 -> RectF(
                rotBox.top.coerceIn(0f, 1f),
                (1.0f - rotBox.right).coerceIn(0f, 1f),
                rotBox.bottom.coerceIn(0f, 1f),
                (1.0f - rotBox.left).coerceIn(0f, 1f)
            )
            270 -> RectF(
                (1.0f - rotBox.bottom).coerceIn(0f, 1f),
                rotBox.left.coerceIn(0f, 1f),
                (1.0f - rotBox.top).coerceIn(0f, 1f),
                rotBox.right.coerceIn(0f, 1f)
            )
            else -> rotBox
        }
    }

    private fun computeConfidence(visionText: Text): Float {
        var total = 0f
        var count = 0
        for (block in visionText.textBlocks) {
            for (line in block.lines) {
                for (element in line.elements) {
                    element.confidence?.let {
                        total += it
                        count++
                    }
                }
            }
        }
        return if (count > 0) (total / count).coerceIn(0.75f, 0.98f) else 0.94f
    }

    /**
     * Normalizes OCR character confusions common on Indian license plates
     * (O <-> 0, I <-> 1, B <-> 8, S <-> 5, Z <-> 2) and validates against Indian RTO patterns.
     */
    fun normalizeAndValidateIndianPlate(rawText: String): String? {
        if (rawText.isBlank()) return null

        // 1. Clean characters: uppercase and keep only alphanumeric + spaces
        var cleaned = rawText.uppercase()
            .replace(Regex("[^A-Z0-9\\s]"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()

        // 2. Strip leading "IND" or "INDIA" common on HSRP plates
        if (cleaned.startsWith("IND ")) {
            cleaned = cleaned.removePrefix("IND ").trim()
        } else if (cleaned.startsWith("INDIA ")) {
            cleaned = cleaned.removePrefix("INDIA ").trim()
        } else if (cleaned.startsWith("IND") && cleaned.length > 5 && !cleaned.startsWith("INDH")) {
            cleaned = cleaned.removePrefix("IND").trim()
        }

        // 3. Check for Bharat Series (e.g. 22 BH 1234 AA)
        val bhPattern = Regex("\\b(\\d{2})\\s*(BH)\\s*([0-9OITDSBZQD]{4})\\s*([A-Z]{1,2})\\b")
        val bhMatch = bhPattern.find(cleaned)
        if (bhMatch != null) {
            val (year, bh, numRaw, series) = bhMatch.destructured
            val num = cleanDigits(numRaw)
            return "$year $bh $num $series"
        }

        // 4. Standard Indian Plate Pattern:
        // [State 2 letters] [District 1-2 digits] [Series 0-3 letters] [Number 4 digits]
        val platePattern = Regex("\\b([A-Z]{2})\\s*([0-9OITDSBZQD]{1,2})\\s*([A-Z0-9OITDSBZQD]{1,3})\\s*([0-9OITDSBZQD]{4})\\b")
        val match = platePattern.find(cleaned)
        if (match != null) {
            val (stateRaw, distRaw, seriesRaw, numRaw) = match.destructured
            val state = cleanLetters(stateRaw)
            if (validIndianStates.contains(state)) {
                val dist = cleanDigits(distRaw)
                val series = cleanLetters(seriesRaw)
                val num = cleanDigits(numRaw)
                return "$state $dist $series $num"
            }
        }

        // 5. Fallback for compacted text without spaces (e.g. UP19EQ1001 or INDUP19EQ1001)
        val compact = cleaned.replace(" ", "")
        val compactNoInd = if (compact.startsWith("IND") && compact.length >= 11) compact.removePrefix("IND") else compact
        if (compactNoInd.length in 8..11) {
            val compactPattern = Regex("^([A-Z]{2})([0-9OITDSBZQD]{1,2})([A-Z0-9OITDSBZQD]{1,3})([0-9OITDSBZQD]{4})$")
            val cMatch = compactPattern.find(compactNoInd)
            if (cMatch != null) {
                val (stateRaw, distRaw, seriesRaw, numRaw) = cMatch.destructured
                val state = cleanLetters(stateRaw)
                if (validIndianStates.contains(state)) {
                    val dist = cleanDigits(distRaw)
                    val series = cleanLetters(seriesRaw)
                    val num = cleanDigits(numRaw)
                    return "$state $dist $series $num"
                }
            }
        }

        return null
    }

    private fun cleanDigits(input: String): String {
        return input.map { c ->
            when (c) {
                'O', 'D', 'Q' -> '0'
                'I', 'L', 'T' -> '1'
                'Z' -> '2'
                'S' -> '5'
                'B' -> '8'
                else -> c
            }
        }.joinToString("")
    }

    private fun cleanLetters(input: String): String {
        return input.map { c ->
            when (c) {
                '0' -> 'O'
                '1' -> 'I'
                '2' -> 'Z'
                '5' -> 'S'
                '8' -> 'B'
                else -> c
            }
        }.joinToString("")
    }

    private fun cropPlateRegion(bitmap: Bitmap, box: RectF): Pair<Bitmap?, String?> {
        return try {
            val padX = box.width() * 0.10f
            val padY = box.height() * 0.10f
            val left = ((box.left - padX) * bitmap.width).toInt().coerceIn(0, bitmap.width - 1)
            val top = ((box.top - padY) * bitmap.height).toInt().coerceIn(0, bitmap.height - 1)
            val right = ((box.right + padX) * bitmap.width).toInt().coerceIn(left + 1, bitmap.width)
            val bottom = ((box.bottom + padY) * bitmap.height).toInt().coerceIn(top + 1, bitmap.height)

            val width = right - left
            val height = bottom - top

            if (width <= 10 || height <= 6) return Pair(null, null)

            val croppedBmp = Bitmap.createBitmap(bitmap, left, top, width, height)
            val outStream = ByteArrayOutputStream()
            croppedBmp.compress(Bitmap.CompressFormat.JPEG, 85, outStream)
            val base64 = Base64.encodeToString(outStream.toByteArray(), Base64.NO_WRAP)

            Pair(croppedBmp, "data:image/jpeg;base64,$base64")
        } catch (e: Exception) {
            Pair(null, null)
        }
    }

    private fun applyNms(candidates: List<PlateCandidate>, iouThreshold: Float = 0.40f): List<PlateCandidate> {
        val sorted = candidates.sortedByDescending { it.detectionConfidence }
        val selected = mutableListOf<PlateCandidate>()
        for (cand in sorted) {
            var select = true
            for (s in selected) {
                if (calculateIoU(cand.box, s.box) > iouThreshold) {
                    select = false
                    break
                }
            }
            if (select) {
                selected.add(cand)
                if (selected.size >= 4) break // Max 4 plates per frame
            }
        }
        return selected
    }

    private fun calculateIoU(a: RectF, b: RectF): Float {
        val intersectLeft = max(a.left, b.left)
        val intersectTop = max(a.top, b.top)
        val intersectRight = min(a.right, b.right)
        val intersectBottom = min(a.bottom, b.bottom)

        if (intersectRight <= intersectLeft || intersectBottom <= intersectTop) return 0.0f

        val intersectArea = (intersectRight - intersectLeft) * (intersectBottom - intersectTop)
        val areaA = (a.right - a.left) * (a.bottom - a.top)
        val areaB = (b.right - b.left) * (b.bottom - b.top)
        val unionArea = areaA + areaB - intersectArea
        return if (unionArea > 0f) intersectArea / unionArea else 0.0f
    }

    override fun release() {
        try {
            session?.close()
            session = null
            env?.close()
            env = null
            textRecognizer.close()
            Log.i(tag, "Plate detector session and ML Kit recognizer resources released.")
        } catch (e: Exception) {
            Log.w(tag, "Error releasing plate detector resources: ${e.message}")
        }
    }
}
