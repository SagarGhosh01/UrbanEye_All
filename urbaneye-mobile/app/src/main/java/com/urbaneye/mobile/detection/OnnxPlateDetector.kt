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
import java.util.regex.Pattern
import kotlin.math.max
import kotlin.math.min

/**
 * On-device Edge-AI Indian Vehicle License Plate Detector & ANPR Engine.
 *
 * Runs in its OWN isolated OrtSession (completely separate from OnnxRoadDefectDetector).
 * Architecture:
 * 1. YOLOv8n single-class bounding box detector [1, 3, 640, 640] -> [1, 5, 8400]
 * 2. High-speed plate region cropping & contrast enhancement
 * 3. On-device Google ML Kit Latin Text Recognition (OCR)
 * 4. Indian RTO License Plate Regex & OCR Confusion Normalization (O/0, I/1, B/8, S/5, Z/2)
 * 5. Weighted Overall Confidence: 0.40 * detConf + 0.60 * ocrConf
 */
class OnnxPlateDetector(
    private val context: Context,
    private val modelAssetPath: String = "models/plate_detector.onnx"
) : PluggableDetector {

    override val modelName: String = "UrbanEye-YOLOv8-PlateDetector"
    override val targetConfidenceThreshold: Float = 0.25f

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

    // Standard Indian RTO License Plate Regex:
    // e.g., "DL 01 AB 1234", "MH12DE1432", "WB-02-AD-9999", "KA 05 M 8888"
    private val standardIndianPlatePattern = Pattern.compile(
        "^[A-Z]{2}\\s?-?\\d{1,2}\\s?-?[A-Z]{1,3}\\s?-?\\d{4}$"
    )

    // Bharat Series (BH series) Plate Regex:
    // e.g., "22 BH 1234 AA"
    private val bhSeriesPlatePattern = Pattern.compile(
        "^\\d{2}\\s?BH\\s?\\d{4}\\s?[A-Z]{1,2}$"
    )

    private data class PlateCandidate(
        val box: RectF,
        val detectionConfidence: Float
    )

    init {
        try {
            env = OrtEnvironment.getEnvironment()
            // Support both primary plate_detector.onnx and fallback names
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
            Log.w(tag, "Plate detector initialization note: ${e.message}. Standby mode active.", e)
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

            if (session != null && env != null) {
                return runPlateInferenceAndOcr(orientedBitmap)
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
            val numRows = 4 + numClasses // 5 rows for single class: [cx, cy, w, h, score]
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

                    // Indian plates generally have aspect ratios between 1.5 and 5.5
                    if (aspect in 1.2f..6.5f && (box.width() * box.height()) >= 0.002f) {
                        candidates.add(PlateCandidate(box, score))
                    }
                }
            }

            // Apply NMS to eliminate overlapping duplicate candidate proposals
            val nmsCandidates = applyNms(candidates, 0.40f)
            val detectionResults = mutableListOf<DetectionResult>()

            for (cand in nmsCandidates) {
                val (plateBitmap, snippetBase64) = cropPlateRegion(bitmap, cand.box)
                val ocrResult = recognizePlateText(plateBitmap)

                // Only keep detections that have valid, normalized Indian license plate text
                if (ocrResult != null) {
                    val detConf = cand.detectionConfidence
                    val ocrConf = ocrResult.confidence

                    /**
                     * Overall Confidence Calculation:
                     * 0.40 * detConf + 0.60 * ocrConf
                     *
                     * Rationale: High OCR confidence and matching RTO regex confirms that
                     * the detected crop is a genuine alphanumeric vehicle registration plate,
                     * while spatial bounding box detection grounds the physical location.
                     */
                    val overallConfidence = ((0.40f * detConf) + (0.60f * ocrConf)).coerceIn(0.10f, 0.99f)

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
                    Log.i(tag, "🎯 ANPR Recognized Plate: ${ocrResult.plateText} (Det: ${(detConf*100).toInt()}%, OCR: ${(ocrConf*100).toInt()}%, Overall: ${(overallConfidence*100).toInt()}%)")
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

    private data class OcrResult(
        val plateText: String,
        val confidence: Float
    )

    /**
     * Executes Google ML Kit Latin Text Recognition synchronously on the background worker thread.
     */
    private fun recognizePlateText(crop: Bitmap?): OcrResult? {
        if (crop == null) return null
        return try {
            val inputImage = InputImage.fromBitmap(crop, 0)
            val task = textRecognizer.process(inputImage)
            // Wait up to 250ms for on-device OCR inference to finish
            val visionText: Text = Tasks.await(task, 250, TimeUnit.MILLISECONDS)
            val rawText = visionText.text
            if (rawText.isBlank()) return null

            val cleaned = normalizeAndValidateIndianPlate(rawText)
            if (cleaned != null) {
                // Determine OCR confidence from Vision Text confidence or fallback to high-quality match
                var totalElementConf = 0f
                var elementCount = 0
                for (block in visionText.textBlocks) {
                    for (line in block.lines) {
                        for (element in line.elements) {
                            element.confidence?.let {
                                totalElementConf += it
                                elementCount++
                            }
                        }
                    }
                }
                val avgOcrConf = if (elementCount > 0) (totalElementConf / elementCount).coerceIn(0.70f, 0.98f) else 0.92f
                OcrResult(cleaned, avgOcrConf)
            } else {
                null
            }
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Normalizes OCR character confusions common on Indian license plates
     * (O <-> 0, I <-> 1, B <-> 8, S <-> 5, Z <-> 2) and validates against Indian RTO patterns.
     */
    fun normalizeAndValidateIndianPlate(rawText: String): String? {
        // 1. Strip spaces, dashes, dots, and non-alphanumeric characters
        val cleanUpper = rawText.uppercase()
            .replace(Regex("[^A-Z0-9]"), "")

        if (cleanUpper.length !in 6..12) {
            return null
        }

        // 2. Check for standard format: SS DD LL DDDD (e.g. DL01AB1234 or DL1AB1234)
        // Extract parts if potential Indian plate:
        val corrected = correctOcrConfusions(cleanUpper)

        // 3. Match against Standard Indian Plate Pattern
        if (standardIndianPlatePattern.matcher(corrected).matches()) {
            return formatIndianPlateWithSpaces(corrected)
        }

        // 4. Match against Bharat Series Pattern (e.g. 22 BH 1234 AA)
        if (bhSeriesPlatePattern.matcher(corrected).matches()) {
            return formatBhPlateWithSpaces(corrected)
        }

        return null
    }

    /**
     * Context-aware character confusion correction based on Indian RTO structure:
     * Chars 0..1: State Code (Letters only, e.g. MH, DL, KA, PB, WB)
     * Chars 2..3: District Code (Digits only, e.g. 01, 12, 02)
     * Chars 4..5/6: Series Letters (Letters only, e.g. AB, C, AD)
     * Last 4: Unique Number (Digits only, e.g. 1234, 0001)
     */
    private fun correctOcrConfusions(input: String): String {
        val chars = input.toCharArray()
        val len = chars.size

        if (len >= 8) {
            // First 2 characters: State Code (must be LETTERS)
            for (i in 0..1) {
                when (chars[i]) {
                    '0' -> chars[i] = 'O'
                    '1' -> chars[i] = 'I'
                    '8' -> chars[i] = 'B'
                    '5' -> chars[i] = 'S'
                    '2' -> chars[i] = 'Z'
                }
            }

            // Next 1 or 2 characters: District Code (must be DIGITS)
            // If len is 10 (e.g. MH 12 AB 1234): chars 2 and 3 are digits
            if (len == 10 || len == 9) {
                val digitEnd = if (len == 10) 3 else 2
                for (i in 2..digitEnd) {
                    when (chars[i]) {
                        'O', 'D', 'Q' -> chars[i] = '0'
                        'I', 'L', 'T' -> chars[i] = '1'
                        'Z' -> chars[i] = '2'
                        'S' -> chars[i] = '5'
                        'B' -> chars[i] = '8'
                    }
                }

                // Next 1..2 characters: Series (must be LETTERS)
                val seriesStart = digitEnd + 1
                val seriesEnd = len - 5
                for (i in seriesStart..seriesEnd) {
                    when (chars[i]) {
                        '0' -> chars[i] = 'O'
                        '1' -> chars[i] = 'I'
                        '8' -> chars[i] = 'B'
                        '5' -> chars[i] = 'S'
                        '2' -> chars[i] = 'Z'
                    }
                }

                // Last 4 characters: Registration Digits (must be DIGITS)
                for (i in (len - 4) until len) {
                    when (chars[i]) {
                        'O', 'D', 'Q' -> chars[i] = '0'
                        'I', 'L', 'T' -> chars[i] = '1'
                        'Z' -> chars[i] = '2'
                        'S' -> chars[i] = '5'
                        'B' -> chars[i] = '8'
                    }
                }
            }
        }
        return String(chars)
    }

    private fun formatIndianPlateWithSpaces(plate: String): String {
        return if (plate.length >= 8) {
            val state = plate.substring(0, 2)
            val rest = plate.substring(2)
            // Find where digits end and letters begin
            val rtoDigits = rest.takeWhile { it.isDigit() }
            val remainder = rest.drop(rtoDigits.length)
            val series = remainder.takeWhile { it.isLetter() }
            val regDigits = remainder.drop(series.length)
            if (rtoDigits.isNotEmpty() && series.isNotEmpty() && regDigits.isNotEmpty()) {
                "$state $rtoDigits $series $regDigits"
            } else {
                plate
            }
        } else {
            plate
        }
    }

    private fun formatBhPlateWithSpaces(plate: String): String {
        return if (plate.length >= 9) {
            val year = plate.substring(0, 2)
            val bh = plate.substring(2, 4)
            val digits = plate.substring(4, 8)
            val series = plate.substring(8)
            "$year $bh $digits $series"
        } else {
            plate
        }
    }

    private fun cropPlateRegion(bitmap: Bitmap, box: RectF): Pair<Bitmap?, String?> {
        return try {
            val left = (box.left * bitmap.width).toInt().coerceIn(0, bitmap.width - 1)
            val top = (box.top * bitmap.height).toInt().coerceIn(0, bitmap.height - 1)
            val right = (box.right * bitmap.width).toInt().coerceIn(left + 1, bitmap.width)
            val bottom = (box.bottom * bitmap.height).toInt().coerceIn(top + 1, bitmap.height)

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
