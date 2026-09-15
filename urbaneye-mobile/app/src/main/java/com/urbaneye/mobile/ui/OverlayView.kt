package com.urbaneye.mobile.ui

import android.content.Context
import android.graphics.*
import android.util.AttributeSet
import android.view.View
import com.urbaneye.mobile.detection.DetectionResult

class OverlayView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    // HUD Paint definitions
    private val boxPaint = Paint().apply {
        style = Paint.Style.STROKE
        strokeWidth = 6f
        isAntiAlias = true
    }

    private val cornerPaint = Paint().apply {
        style = Paint.Style.STROKE
        strokeWidth = 8f
        strokeCap = Paint.Cap.ROUND
        isAntiAlias = true
    }

    private val fillGlowPaint = Paint().apply {
        style = Paint.Style.FILL
        isAntiAlias = true
    }

    private val reticlePaint = Paint().apply {
        style = Paint.Style.STROKE
        strokeWidth = 3f
        isAntiAlias = true
    }

    private val textBgPaint = Paint().apply {
        style = Paint.Style.FILL
        color = Color.argb(220, 15, 23, 42) // Dark Slate-900 glass backdrop
    }

    private val textPaint = Paint().apply {
        color = Color.WHITE
        textSize = 32f
        isFakeBoldText = true
        isAntiAlias = true
    }

    private val badgePaint = Paint().apply {
        color = Color.rgb(245, 158, 11) // Amber badge
        textSize = 24f
        isFakeBoldText = true
        isAntiAlias = true
    }

    private var detections: List<DetectionResult> = emptyList()

    fun setDetections(results: List<DetectionResult>) {
        this.detections = results
        postInvalidate()
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        val viewWidth = width.toFloat()
        val viewHeight = height.toFloat()

        for (detection in detections) {
            val box = detection.boundingBox

            // Map normalized coordinates [0, 1] to view dimensions
            val screenRect = RectF(
                box.left * viewWidth,
                box.top * viewHeight,
                box.right * viewWidth,
                box.bottom * viewHeight
            )

            // Distinct color coding: #dc2626 Alert Crimson is strictly reserved for incidents/ANPR
            val isIncident = detection.type == "ANPR_INCIDENT" || detection.category == "ANPR_INCIDENT" ||
                    detection.type == "HIT_AND_RUN" || detection.type == "RASH_DRIVING" || detection.category == "INCIDENT"

            val (colorHex, severityLabel) = when {
                isIncident                 -> Pair(Color.rgb(220,  38,  38), "🚨 INCIDENT")   // #dc2626 Alert Crimson (Exclusively Reserved)
                detection.type == "POTHOLE"-> Pair(Color.rgb(249, 115,  22), "⚠️ POTHOLE")    // #f97316 Signal Orange
                detection.type.contains("CRACK") -> Pair(Color.rgb(234, 179,   8), "⚠️ CRACK") // #eab308 Balanced Amber
                // Road-marking wear: model classes D43 and D44 respectively.
                detection.type == "FADED_ZEBRA_CROSSING" -> Pair(Color.rgb(  5, 150, 105), "🚸 MARKING")  // #059669 Emerald
                detection.type == "FADED_LANE_MARKING" -> Pair(Color.rgb(  8, 145, 178), "🛣️ LANE WEAR") // #0891b2 Cyan
                detection.type == "UTILITY_COVER" -> Pair(Color.rgb(146,  64,  14), "⚠️ COVER")  // #92400e Ochre
                detection.type == "SURFACE_DAMAGE" -> Pair(Color.rgb(148, 163, 184), "⚡ WEAR")// #94a3b8 Slate-adjacent
                detection.type == "WATERLOGGING" -> Pair(Color.rgb(  2, 132, 199), "💧 WATERLOG")// #0284c7 Blue
                detection.type == "VEHICLE_FLOW" -> Pair(Color.rgb(139,  92, 246), "🚗 DENSITY") // #8b5cf6 Purple
                detection.type == "ROAD_EDGE_DAMAGE" -> Pair(Color.rgb(234,  88,  12), "⚠️ EDGE") // #ea580c Tangerine
                detection.type == "MISSING_DIVIDER" -> Pair(Color.rgb( 13, 148, 136), "🚧 HAZARD")// #0d9488 Signal Teal
                else                       -> Pair(Color.rgb( 94, 234, 212), "ℹ️ DEFECT")    // #5eead4 Mint Teal
            }

            // 1. Light translucent glow fill inside target area
            val fillAlpha = if (isIncident) 55 else 35
            fillGlowPaint.color = Color.argb(fillAlpha, Color.red(colorHex), Color.green(colorHex), Color.blue(colorHex))
            canvas.drawRoundRect(screenRect, 10f, 10f, fillGlowPaint)

            // 2. Full bounding box path (bolder for ANPR incidents)
            boxPaint.color = Color.argb(if (isIncident) 220 else 140, Color.red(colorHex), Color.green(colorHex), Color.blue(colorHex))
            boxPaint.strokeWidth = if (isIncident) 8f else 6f
            canvas.drawRoundRect(screenRect, 10f, 10f, boxPaint)

            // 3. Futuristic HUD corner brackets (┌ ┐ └ ┘)
            cornerPaint.color = colorHex
            val cLen = (screenRect.width() * 0.25f).coerceIn(24f, 65f)
            val cLenY = (screenRect.height() * 0.25f).coerceIn(24f, 65f)

            // Top-Left (┌)
            canvas.drawLine(screenRect.left, screenRect.top, screenRect.left + cLen, screenRect.top, cornerPaint)
            canvas.drawLine(screenRect.left, screenRect.top, screenRect.left, screenRect.top + cLenY, cornerPaint)

            // Top-Right (┐)
            canvas.drawLine(screenRect.right, screenRect.top, screenRect.right - cLen, screenRect.top, cornerPaint)
            canvas.drawLine(screenRect.right, screenRect.top, screenRect.right, screenRect.top + cLenY, cornerPaint)

            // Bottom-Left (└)
            canvas.drawLine(screenRect.left, screenRect.bottom, screenRect.left + cLen, screenRect.bottom, cornerPaint)
            canvas.drawLine(screenRect.left, screenRect.bottom, screenRect.left, screenRect.bottom - cLenY, cornerPaint)

            // Bottom-Right (┘)
            canvas.drawLine(screenRect.right, screenRect.bottom, screenRect.right - cLen, screenRect.bottom, cornerPaint)
            canvas.drawLine(screenRect.right, screenRect.bottom, screenRect.right, screenRect.bottom - cLenY, cornerPaint)

            // 4. Center Crosshair Reticle (+)
            val cx = screenRect.centerX()
            val cy = screenRect.centerY()
            reticlePaint.color = colorHex
            canvas.drawLine(cx - 12f, cy, cx + 12f, cy, reticlePaint)
            canvas.drawLine(cx, cy - 12f, cx, cy + 12f, reticlePaint)

            // 5. Label Header Pill (displays recognized license plate boldly if present)
            val confPct = (detection.confidence * 100).toInt()
            val fullLabel = if (detection.registrationNumber != null) {
                "🚨 ANPR: ${detection.registrationNumber} ($confPct%)"
            } else {
                val typeTitle = detection.type.replace("_", " ")
                val diamStr = if (detection.estimatedDiameterCm != null) " • Ø ${detection.estimatedDiameterCm} cm" else ""
                val costStr = if (detection.estimatedRepairCost != null) " • ₹${detection.estimatedRepairCost}" else ""
                "$typeTitle $confPct%$diamStr$costStr"
            }

            val textWidth = textPaint.measureText(fullLabel)
            val textHeight = 48f
            val pillMargin = 10f

            val pillTop = if (screenRect.top < textHeight + pillMargin + 40f) {
                // Draw label INSIDE top of bounding box when near screen/HUD top edge
                screenRect.top + 8f
            } else {
                // Draw label ABOVE top of bounding box
                screenRect.top - textHeight - pillMargin
            }

            val labelRect = RectF(
                screenRect.left,
                pillTop,
                screenRect.left + textWidth + 28f,
                pillTop + textHeight
            )

            // Draw pill background & border
            canvas.drawRoundRect(labelRect, 8f, 8f, textBgPaint)
            cornerPaint.color = Color.argb(220, Color.red(colorHex), Color.green(colorHex), Color.blue(colorHex))
            canvas.drawRoundRect(labelRect, 8f, 8f, cornerPaint)

            // Draw primary defect title & telemetry text
            textPaint.color = Color.WHITE
            canvas.drawText(fullLabel, labelRect.left + 14f, labelRect.bottom - 14f, textPaint)
        }
    }
}
