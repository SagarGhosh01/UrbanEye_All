package com.urbaneye.mobile.detection

import android.content.Context
import android.graphics.Bitmap
import android.graphics.RectF
import android.util.Log
import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import java.nio.FloatBuffer

/**
 * Counts vehicles and pedestrians from the bus camera using a stock COCO-pretrained
 * YOLOv8n. No custom training was needed: person, bicycle, car, motorcycle, bus and
 * truck are all standard COCO classes.
 *
 * This runs alongside OnnxRoadDefectDetector, which handles road surface condition.
 * Two small models rather than one large one, because the road model is fine-tuned on
 * road damage and retraining it to also carry vehicle classes would cost accuracy on
 * the classes that matter most.
 *
 * Output feeds POST /api/traffic/observations, where segment congestion is derived from
 * these counts plus the bus's own GPS speed.
 *
 * Model: export with ml/training/export_coco_traffic_model.py, place the result at
 * assets/models/coco_traffic.onnx.
 */
class CocoTrafficDetector(
    private val context: Context,
    private val modelAssetPath: String = "models/coco_traffic.onnx"
) : PluggableDetector {

    override val modelName: String = "UrbanEye-COCO-Traffic"
    override val targetConfidenceThreshold: Float = 0.35f

    private val tag = "CocoTrafficDetector"
    private var env: OrtEnvironment? = null
    private var session: OrtSession? = null

    private val inputWidth = 320
    private val inputHeight = 320
    private val numClasses = 80          // full COCO
    private var numAnchors = 2100

    // COCO indices we care about, mapped to UrbanEye vehicle classes. Everything else
    // in the 80-class space is ignored rather than counted as traffic.
    private val cocoClassToVehicle = mapOf(
        0 to "PEDESTRIAN",
        1 to "TWO_WHEELER",   // bicycle
        2 to "CAR",
        3 to "TWO_WHEELER",   // motorcycle
        5 to "BUS",
        7 to "TRUCK"
    )

    private data class Candidate(val vehicleClass: String, val score: Float, val box: RectF)

    /** Rolling counts for the current reporting window, read by the sync manager. */
    data class TrafficCounts(
        val cars: Int = 0,
        val twoWheelers: Int = 0,
        val buses: Int = 0,
        val trucks: Int = 0,
        val pedestrians: Int = 0
    ) {
        val totalVehicles: Int get() = cars + twoWheelers + buses + trucks
    }

    private fun ensureSession(): OrtSession? {
        if (session != null) return session
        return try {
            val environment = OrtEnvironment.getEnvironment()
            val modelBytes = context.assets.open(modelAssetPath).readBytes()
            val options = OrtSession.SessionOptions().apply {
                setIntraOpNumThreads(2)   // leave headroom for the road defect model
            }
            env = environment
            session = environment.createSession(modelBytes, options)
            Log.i(tag, "COCO traffic model loaded from $modelAssetPath")
            session
        } catch (e: Exception) {
            // Absent model is not fatal: the app still detects road defects without it.
            Log.w(tag, "COCO traffic model unavailable, vehicle counting disabled: ${e.message}")
            null
        }
    }

    override fun detect(bitmap: Bitmap, rotationDegrees: Int): List<DetectionResult> {
        val activeSession = ensureSession() ?: return emptyList()

        return try {
            val scaled = Bitmap.createScaledBitmap(bitmap, inputWidth, inputHeight, true)
            val buffer = FloatBuffer.allocate(inputWidth * inputHeight * 3)
            val pixels = IntArray(inputWidth * inputHeight)
            scaled.getPixels(pixels, 0, inputWidth, 0, 0, inputWidth, inputHeight)

            // CHW, normalised to [0,1] — same contract as the road defect model.
            for (channel in 0 until 3) {
                for (pixel in pixels) {
                    val value = when (channel) {
                        0 -> (pixel shr 16) and 0xFF
                        1 -> (pixel shr 8) and 0xFF
                        else -> pixel and 0xFF
                    }
                    buffer.put(value / 255.0f)
                }
            }
            buffer.rewind()

            val shape = longArrayOf(1, 3, inputHeight.toLong(), inputWidth.toLong())
            val inputName = activeSession.inputNames.iterator().next()
            OnnxTensor.createTensor(env, buffer, shape).use { tensor ->
                activeSession.run(mapOf(inputName to tensor)).use { results ->
                    @Suppress("UNCHECKED_CAST")
                    val raw = results[0].value as Array<Array<FloatArray>>
                    decode(raw)
                }
            }
        } catch (e: Exception) {
            Log.e(tag, "COCO inference failed: ${e.message}")
            emptyList()
        }
    }

    private fun decode(raw: Array<Array<FloatArray>>): List<DetectionResult> {
        val output = raw[0]
        val numRows = 4 + numClasses
        // Handles both [1, 84, anchors] and [1, anchors, 84] layouts.
        val transposed = output.size == numRows
        numAnchors = if (transposed) output[0].size else output.size

        val candidates = mutableListOf<Candidate>()

        for (anchor in 0 until numAnchors) {
            fun at(row: Int): Float = if (transposed) output[row][anchor] else output[anchor][row]

            var bestScore = 0f
            var bestClass = -1
            for (c in 0 until numClasses) {
                val score = at(4 + c)
                if (score > bestScore) {
                    bestScore = score
                    bestClass = c
                }
            }
            if (bestScore < targetConfidenceThreshold) continue

            val vehicleClass = cocoClassToVehicle[bestClass] ?: continue

            val cx = at(0); val cy = at(1); val w = at(2); val h = at(3)
            val left = ((cx - w / 2f) / inputWidth).coerceIn(0f, 0.98f)
            val top = ((cy - h / 2f) / inputHeight).coerceIn(0f, 0.98f)
            val right = ((cx + w / 2f) / inputWidth).coerceIn(left + 0.02f, 1f)
            val bottom = ((cy + h / 2f) / inputHeight).coerceIn(top + 0.02f, 1f)

            candidates.add(Candidate(vehicleClass, bestScore, RectF(left, top, right, bottom)))
        }

        return applyNms(candidates, 0.45f).map { c ->
            DetectionResult(
                type = if (c.vehicleClass == "PEDESTRIAN") "SCHOOL_CHILDREN_CROSSING" else "VEHICLE_FLOW",
                category = if (c.vehicleClass == "PEDESTRIAN") "SAFETY" else "TRAFFIC",
                confidence = c.score,
                boundingBox = c.box,
                vehicleType = c.vehicleClass
            )
        }
    }

    /** Counts one frame's detections into the shape the observations endpoint expects. */
    fun countFrame(detections: List<DetectionResult>): TrafficCounts {
        var cars = 0; var twoWheelers = 0; var buses = 0; var trucks = 0; var pedestrians = 0
        for (d in detections) {
            when (d.vehicleType) {
                "CAR" -> cars++
                "TWO_WHEELER" -> twoWheelers++
                "BUS" -> buses++
                "TRUCK" -> trucks++
                "PEDESTRIAN" -> pedestrians++
            }
        }
        return TrafficCounts(cars, twoWheelers, buses, trucks, pedestrians)
    }

    private fun applyNms(candidates: List<Candidate>, iouThreshold: Float): List<Candidate> {
        val sorted = candidates.sortedByDescending { it.score }.toMutableList()
        val kept = mutableListOf<Candidate>()
        while (sorted.isNotEmpty()) {
            val best = sorted.removeAt(0)
            kept.add(best)
            sorted.removeAll { other ->
                other.vehicleClass == best.vehicleClass && iou(best.box, other.box) > iouThreshold
            }
        }
        return kept
    }

    private fun iou(a: RectF, b: RectF): Float {
        val interLeft = maxOf(a.left, b.left)
        val interTop = maxOf(a.top, b.top)
        val interRight = minOf(a.right, b.right)
        val interBottom = minOf(a.bottom, b.bottom)
        if (interRight <= interLeft || interBottom <= interTop) return 0f
        val intersection = (interRight - interLeft) * (interBottom - interTop)
        val union = a.width() * a.height() + b.width() * b.height() - intersection
        return if (union <= 0f) 0f else intersection / union
    }

    override fun release() {
        try {
            session?.close()
        } catch (e: Exception) {
            Log.w(tag, "Error releasing COCO session: ${e.message}")
        }
        session = null
        env = null
    }
}
