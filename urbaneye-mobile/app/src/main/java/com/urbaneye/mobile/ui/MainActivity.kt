package com.urbaneye.mobile.ui

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.*
import android.os.Bundle
import android.os.SystemClock
import android.util.Log
import android.view.View
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.urbaneye.mobile.databinding.ActivityMainBinding
import com.urbaneye.mobile.detection.DetectionResult
import com.urbaneye.mobile.detection.FrameThrottler
import com.urbaneye.mobile.detection.OnnxRoadDefectDetector
import com.urbaneye.mobile.detection.OnnxPlateDetector
import com.urbaneye.mobile.detection.PluggableDetector
import com.urbaneye.mobile.detection.TemporalDetectionTracker
import com.urbaneye.mobile.location.LocationTracker
import com.urbaneye.mobile.network.NetworkClient
import com.urbaneye.mobile.pairing.PairingManager
import com.urbaneye.mobile.pairing.PairingState
import com.urbaneye.mobile.sync.EventSyncManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class MainActivity : AppCompatActivity() {

    private val tag = "UrbanEyeMainActivity"
    private lateinit var binding: ActivityMainBinding

    // Dual Edge-AI Inference Engines (Both active simultaneously)
    private lateinit var roadDetector: OnnxRoadDefectDetector
    private lateinit var plateDetector: OnnxPlateDetector
    val detector: PluggableDetector get() = roadDetector

    private lateinit var locationTracker: LocationTracker
    private lateinit var pairingManager: PairingManager
    private lateinit var eventSyncManager: EventSyncManager
    private val frameThrottler = FrameThrottler(targetFps = 8)
    private val temporalTracker = TemporalDetectionTracker(requiredHits = 1, maxMissedFrames = 3)

    private var userDismissedPairingOverlay = false
    private var latestBitmap: Bitmap? = null
    private var latestRotationDegrees: Int = 0
    private var isTorchOn = false
    private var camera: androidx.camera.core.Camera? = null

    // Camera & Background Threading
    private var cameraExecutor: ExecutorService = Executors.newSingleThreadExecutor()
    private var plateExecutor: ExecutorService = Executors.newSingleThreadExecutor()

    // Performance-Aware Dual Scheduling & Metrics
    private var lastPlateProcessedTimeMs = 0L
    private var lastRoadLatencyMs = 0L
    @Volatile private var activePlateDetections: List<DetectionResult> = emptyList()
    @Volatile private var isPlateInferenceRunning = false

    private var autoTransmittedCount = 0
    private var lastFpsCalculationTime = 0L
    private var framesProcessedSinceLastCalc = 0

    // Permissions
    private val requiredPermissions = arrayOf(
        Manifest.permission.CAMERA,
        Manifest.permission.ACCESS_FINE_LOCATION,
        Manifest.permission.ACCESS_COARSE_LOCATION
    )

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { perms ->
        val cameraGranted = perms[Manifest.permission.CAMERA] == true
        if (cameraGranted) {
            startCamera()
        } else {
            Toast.makeText(this, "Camera permission is strictly required for automated bus CCTV AI capture.", Toast.LENGTH_LONG).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // 1. Initialize Dual Edge-AI Inference Engines
        roadDetector = OnnxRoadDefectDetector(applicationContext)
        plateDetector = OnnxPlateDetector(applicationContext)
        locationTracker = LocationTracker(applicationContext)
        pairingManager = PairingManager(applicationContext)
        eventSyncManager = EventSyncManager(applicationContext)

        // 2. Setup UI Listeners
        binding.tvServerUrlDisplay.text = "Backend: ${NetworkClient.baseUrl}"

        binding.btnRefreshPin.setOnClickListener {
            userDismissedPairingOverlay = false
            pairingManager.unpairAndReset()
        }

        binding.btnDismissPairing.setOnClickListener {
            userDismissedPairingOverlay = true
            binding.pairingOverlay.visibility = View.GONE
            if (pairingManager.getActiveSessionId() == null) {
                Toast.makeText(this, "Camera preview active. AI Capture is locked until device is paired via Web Portal.", Toast.LENGTH_LONG).show()
            } else {
                Toast.makeText(this, "Automated Bus CCTV Mode Active. Mounting camera facing road.", Toast.LENGTH_SHORT).show()
            }
        }

        binding.btnShowPinOverlay.setOnClickListener {
            userDismissedPairingOverlay = false
            binding.pairingOverlay.visibility = View.VISIBLE
        }

        binding.btnTriggerTestDefect.setOnClickListener {
            triggerManualPotholeTest()
        }
        binding.btnTriggerTestDefect.setOnLongClickListener {
            triggerManualPlateTest()
            true
        }

        binding.btnToggleTorch.setOnClickListener {
            toggleTorch()
        }

        binding.btnServerConfig.setOnClickListener {
            val input = android.widget.EditText(this).apply {
                setText(NetworkClient.baseUrl)
                setSingleLine()
            }
            androidx.appcompat.app.AlertDialog.Builder(this)
                .setTitle("Command Center Server URL")
                .setMessage("Enter laptop IP & port running UrbanEye Command (e.g. http://172.21.0.178:5000/):")
                .setView(input)
                .setPositiveButton("Save & Reconnect") { _, _ ->
                    val newUrl = input.text.toString().trim()
                    if (newUrl.isNotEmpty()) {
                        NetworkClient.updateBaseUrl(newUrl)
                        binding.tvServerUrlDisplay.text = "Backend: ${NetworkClient.baseUrl}"
                        pairingManager.unpairAndReset()
                        Toast.makeText(this, "Updated Server URL to ${NetworkClient.baseUrl}", Toast.LENGTH_SHORT).show()
                    }
                }
                .setNegativeButton("Cancel", null)
                .show()
        }

        // 3. Observe Pairing Lifecycle
        lifecycleScope.launch {
            pairingManager.state.collect { state ->
                when (state) {
                    is PairingState.Pending -> {
                        if (!userDismissedPairingOverlay) {
                            binding.pairingOverlay.visibility = View.VISIBLE
                        }
                        val p = state.pin
                        val formattedPin = if (p.length == 6) "${p[0]} ${p[1]} ${p[2]}   ${p[3]} ${p[4]} ${p[5]}" else p
                        binding.tvPinCode.text = formattedPin
                        binding.tvPairingStatus.text = "Awaiting District Head confirmation..."
                        binding.tvBusLabel.text = "PAIRING REQUIRED"
                        binding.pbPairing.visibility = View.VISIBLE
                        binding.tvDetectionStatus.text = "🔒 Capture Locked: Enter PIN in Web Portal"
                        binding.tvDetectionStatus.setTextColor(Color.parseColor("#EAB308"))
                    }
                    is PairingState.Paired -> {
                        binding.pairingOverlay.visibility = View.GONE
                        val districtInfo = if (state.districtName != null) " • ${state.districtName}" else ""
                        binding.tvBusLabel.text = "${state.busLabel}$districtInfo"
                        binding.tvBusLabel.setBackgroundColor(Color.parseColor("#3310B981"))
                        binding.tvDetectionStatus.text = "🟢 Dual AI: Scanning Road Defect + ANPR..."
                        binding.tvDetectionStatus.setTextColor(Color.parseColor("#64748B"))
                        Toast.makeText(this@MainActivity, "Bus CCTV Paired: ${state.busLabel}", Toast.LENGTH_SHORT).show()
                    }
                    is PairingState.Error -> {
                        if (!userDismissedPairingOverlay) {
                            binding.pairingOverlay.visibility = View.VISIBLE
                        }
                        binding.tvPairingStatus.text = state.message
                        binding.pbPairing.visibility = View.GONE
                        binding.tvDetectionStatus.text = "⚠️ Unpaired: ${state.message}"
                        binding.tvDetectionStatus.setTextColor(Color.parseColor("#EF4444"))
                    }
                    else -> {}
                }
            }
        }

        // 4. Check & Request Permissions
        if (allPermissionsGranted()) {
            startCamera()
            locationTracker.startTracking()
        } else {
            permissionLauncher.launch(requiredPermissions)
        }
    }

    private fun allPermissionsGranted(): Boolean = requiredPermissions.all {
        ContextCompat.checkSelfPermission(baseContext, it) == PackageManager.PERMISSION_GRANTED
    }

    private fun toggleTorch() {
        val cam = camera ?: return
        if (cam.cameraInfo.hasFlashUnit()) {
            isTorchOn = !isTorchOn
            cam.cameraControl.enableTorch(isTorchOn)
            binding.btnToggleTorch.text = if (isTorchOn) "🔦 Torch ON" else "🔦 Flash"
            binding.btnToggleTorch.setBackgroundColor(if (isTorchOn) Color.parseColor("#F59E0B") else Color.parseColor("#DC0F172A"))
        } else {
            Toast.makeText(this, "Camera torch/flash not available on this device", Toast.LENGTH_SHORT).show()
        }
    }

    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)

        cameraProviderFuture.addListener({
            val cameraProvider: ProcessCameraProvider = cameraProviderFuture.get()

            val preview = Preview.Builder().build().also {
                it.surfaceProvider = binding.viewFinder.surfaceProvider
            }

            val imageAnalyzer = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
                .build()
                .also {
                    it.setAnalyzer(cameraExecutor) { imageProxy ->
                        processImageProxy(imageProxy)
                    }
                }

            val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA

            try {
                cameraProvider.unbindAll()
                camera = cameraProvider.bindToLifecycle(this, cameraSelector, preview, imageAnalyzer)
                Log.i(tag, "CameraX bound to rear lens successfully as automated CCTV sensor")
            } catch (exc: Exception) {
                Log.e(tag, "CameraX binding failed: ${exc.message}", exc)
            }

        }, ContextCompat.getMainExecutor(this))
    }

    private fun processImageProxy(imageProxy: ImageProxy) {
        try {
            if (!frameThrottler.shouldProcessNextFrame()) {
                return
            }

            val rotationDegrees = imageProxy.imageInfo.rotationDegrees
            val rawBitmap = imageProxy.toBitmap() ?: return
            val bitmap = if (rawBitmap.config == Bitmap.Config.HARDWARE) {
                rawBitmap.copy(Bitmap.Config.ARGB_8888, false) ?: rawBitmap
            } else {
                rawBitmap
            }
            latestBitmap = bitmap
            latestRotationDegrees = rotationDegrees

            // STRICT PAIRING GATE: Gated against capture and transmission until officially paired
            val activeSessionId = pairingManager.getActiveSessionId()
            if (activeSessionId == null) {
                runOnUiThread {
                    binding.overlayView.setDetections(emptyList())
                    binding.tvDetectionStatus.text = "🔒 Capture Locked: Enter PIN in Web Portal to pair"
                    binding.tvDetectionStatus.setTextColor(Color.parseColor("#EAB308"))
                    binding.detectionBanner.visibility = View.GONE
                    binding.tvFps.text = "AI: Idle (Unpaired)"

                    val tel = locationTracker.currentTelemetry
                    binding.tvGpsStatus.text = String.format(
                        "GPS: %.4f, %.4f (%d km/h)",
                        tel.latitude,
                        tel.longitude,
                        tel.speedKmh.toInt()
                    )
                }
                return
            }

            // 1. Primary Cadence: Road Defect Detection (Phase 1 Core)
            val roadStartTime = SystemClock.elapsedRealtime()
            val rawDetections = roadDetector.detect(bitmap, rotationDegrees)
            lastRoadLatencyMs = SystemClock.elapsedRealtime() - roadStartTime

            val confirmedEvents = temporalTracker.processFrame(rawDetections)
            val persistentDetections = temporalTracker.getActivePersistentDetections()

            // 2. Performance-Aware Throttled Cadence: ANPR Plate Detection + OCR
            // Plates don't need continuous 8-10 FPS. Run on background plateExecutor every ~180ms.
            // If phone experiences sustained load (road defect latency > 90ms), throttle plate detector further (400ms).
            val now = SystemClock.elapsedRealtime()
            val plateIntervalMs = if (lastRoadLatencyMs > 90L) 400L else 180L

            if (!isPlateInferenceRunning && (now - lastPlateProcessedTimeMs >= plateIntervalMs)) {
                lastPlateProcessedTimeMs = now
                isPlateInferenceRunning = true
                val plateBitmap = bitmap.copy(bitmap.config ?: Bitmap.Config.ARGB_8888, false)

                plateExecutor.execute {
                    try {
                        val plateResults = plateDetector.detect(plateBitmap, rotationDegrees)
                        if (plateResults.isNotEmpty()) {
                            activePlateDetections = plateResults
                            val pairedSessionId = pairingManager.getActiveSessionId() ?: return@execute
                            val tel = locationTracker.currentTelemetry

                            for (plate in plateResults) {
                                eventSyncManager.dispatchIncidentEvent(
                                    deviceSessionId = pairedSessionId,
                                    category = "ANPR_INCIDENT",
                                    confidence = plate.confidence,
                                    lat = tel.latitude,
                                    lon = tel.longitude,
                                    plateText = plate.registrationNumber,
                                    vehicleType = plate.vehicleType ?: "CAR",
                                    speedKmh = plate.speedKmh ?: tel.speedKmh,
                                    imageSnippetBase64 = plate.croppedSnippetBase64
                                )
                                autoTransmittedCount++
                                runOnUiThread {
                                    binding.tvTripEvents.text = "Auto Transmitted: $autoTransmittedCount"
                                }
                            }
                        } else if (SystemClock.elapsedRealtime() - lastPlateProcessedTimeMs > 1200L) {
                            activePlateDetections = emptyList()
                        }
                    } catch (e: Exception) {
                        Log.e(tag, "Background plate analysis error: ${e.message}", e)
                    } finally {
                        isPlateInferenceRunning = false
                    }
                }
            }

            framesProcessedSinceLastCalc++
            if (now - lastFpsCalculationTime >= 1000L) {
                val fps = (framesProcessedSinceLastCalc * 1000f) / (now - lastFpsCalculationTime)
                lastFpsCalculationTime = now
                framesProcessedSinceLastCalc = 0

                runOnUiThread {
                    binding.tvFps.text = String.format("AI: %.1f FPS", fps)
                }
            }

            // 3. UI Layer: Combine Detections with Emergency Incidents Rendered on Top
            runOnUiThread {
                val combinedDetections = mutableListOf<DetectionResult>()
                combinedDetections.addAll(activePlateDetections)
                val roadDets = if (rawDetections.isNotEmpty()) rawDetections else persistentDetections
                combinedDetections.addAll(roadDets)

                binding.overlayView.setDetections(combinedDetections)

                if (activePlateDetections.isNotEmpty()) {
                    val topPlate = activePlateDetections.first()
                    val plateStr = topPlate.registrationNumber ?: "PLATE"
                    val conf = (topPlate.confidence * 100).toInt()
                    binding.tvDetectionStatus.text = "🚨 ANPR: $plateStr ($conf%) • LOGGED"
                    binding.tvDetectionStatus.setTextColor(Color.parseColor("#dc2626"))
                } else if (roadDets.isNotEmpty()) {
                    val top = roadDets.first()
                    val typeLabel = top.type.replace("_", " ")
                    val diamStr = if (top.estimatedDiameterCm != null) " • Ø${top.estimatedDiameterCm}cm" else ""
                    val costStr = if (top.estimatedRepairCost != null) " • ₹${top.estimatedRepairCost}" else ""
                    binding.tvDetectionStatus.text = "🚧 $typeLabel ${(top.confidence * 100).toInt()}%$diamStr$costStr"
                    binding.tvDetectionStatus.setTextColor(Color.parseColor("#f97316"))

                    if (top.type == "POTHOLE" && top.estimatedDiameterCm != null) {
                        binding.detectionBanner.visibility = View.VISIBLE
                        binding.tvDetectionBannerType.text = "🚨 POTHOLE ${(top.confidence * 100).toInt()}% • AUTO UPLOADING"
                        binding.tvDetectionBannerSize.text = "Ø ${top.estimatedDiameterCm} cm"
                        binding.tvDetectionBannerCost.text = "Fix: ₹${top.estimatedRepairCost ?: "---"}"
                    } else {
                        binding.detectionBanner.visibility = View.GONE
                    }
                } else {
                    binding.tvDetectionStatus.text = "🟢 Dual AI: Scanning Road Defect + ANPR..."
                    binding.tvDetectionStatus.setTextColor(Color.parseColor("#64748B"))
                    binding.detectionBanner.visibility = View.GONE
                }

                val tel = locationTracker.currentTelemetry
                binding.tvGpsStatus.text = String.format(
                    "GPS: %.4f, %.4f (%d km/h)",
                    tel.latitude,
                    tel.longitude,
                    tel.speedKmh.toInt()
                )
            }

            // 4. Auto-transmit Confirmed Road Defects
            if (confirmedEvents.isNotEmpty()) {
                for (det in confirmedEvents) {
                    if (det.confidence >= roadDetector.targetConfidenceThreshold) {
                        val tel = locationTracker.currentTelemetry

                        if (det.type == "RASH_DRIVING" || det.type == "HIT_AND_RUN" || det.category == "INCIDENT") {
                            eventSyncManager.dispatchIncidentEvent(
                                deviceSessionId = activeSessionId,
                                category = det.type,
                                confidence = det.confidence,
                                lat = tel.latitude,
                                lon = tel.longitude,
                                plateText = det.registrationNumber,
                                vehicleType = det.vehicleType ?: "CAR",
                                speedKmh = det.speedKmh ?: tel.speedKmh,
                                imageSnippetBase64 = det.croppedSnippetBase64
                            )
                        } else {
                            eventSyncManager.dispatchDetectionEvent(
                                deviceSessionId = activeSessionId,
                                type = det.type,
                                confidence = det.confidence,
                                lat = tel.latitude,
                                lon = tel.longitude,
                                heading = tel.heading,
                                speed = tel.speedKmh,
                                imageSnippetBase64 = det.croppedSnippetBase64,
                                estimatedDiameterCm = det.estimatedDiameterCm?.toFloat(),
                                estimatedRepairCost = det.estimatedRepairCost?.toFloat()
                            )
                        }

                        autoTransmittedCount++
                        runOnUiThread {
                            binding.tvTripEvents.text = "Auto Transmitted: $autoTransmittedCount"
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(tag, "Image processing error: ${e.message}", e)
        } finally {
            imageProxy.close()
        }
    }

    private fun triggerManualPotholeTest() {
        val activeSessionId = pairingManager.getActiveSessionId()
        if (activeSessionId == null) {
            Toast.makeText(this, "🔒 Pairing Required! Please pair this device using the 6-digit PIN in UrbanEye Web Command Center first.", Toast.LENGTH_LONG).show()
            return
        }

        val bmp = latestBitmap ?: Bitmap.createBitmap(320, 240, Bitmap.Config.ARGB_8888).apply {
            eraseColor(Color.DKGRAY)
        }
        val onnxDetector = roadDetector
        val testResult = onnxDetector.generateTestPothole(bmp, latestRotationDegrees)

        binding.overlayView.setDetections(listOf(testResult))
        val diameterDisplay = if (testResult.estimatedDiameterCm != null) " • Ø ${testResult.estimatedDiameterCm} cm (₹${testResult.estimatedRepairCost})" else ""
        Toast.makeText(this, "⚡ Test Defect Transmitted$diameterDisplay (Long press for ANPR test)", Toast.LENGTH_SHORT).show()

        val tel = locationTracker.currentTelemetry
        eventSyncManager.dispatchDetectionEvent(
            deviceSessionId = activeSessionId,
            type = testResult.type,
            confidence = testResult.confidence,
            lat = tel.latitude,
            lon = tel.longitude,
            heading = tel.heading,
            speed = tel.speedKmh,
            imageSnippetBase64 = testResult.croppedSnippetBase64,
            estimatedDiameterCm = testResult.estimatedDiameterCm?.toFloat(),
            estimatedRepairCost = testResult.estimatedRepairCost?.toFloat()
        )
        autoTransmittedCount++
        binding.tvTripEvents.text = "Auto Transmitted: $autoTransmittedCount"
    }

    fun triggerManualPlateTest() {
        val activeSessionId = pairingManager.getActiveSessionId()
        if (activeSessionId == null) {
            Toast.makeText(this, "🔒 Pairing Required! Please pair this device using the 6-digit PIN in UrbanEye Web Command Center first.", Toast.LENGTH_LONG).show()
            return
        }

        val testResult = DetectionResult(
            type = "ANPR_INCIDENT",
            category = "ANPR_INCIDENT",
            confidence = 0.96f,
            boundingBox = RectF(0.25f, 0.38f, 0.75f, 0.54f),
            croppedSnippetBase64 = null,
            registrationNumber = "DL 01 AB 1234",
            plateConfidence = 0.98f,
            vehicleType = "CAR"
        )

        activePlateDetections = listOf(testResult)
        binding.overlayView.setDetections(listOf(testResult))
        Toast.makeText(this, "🚨 ANPR Incident Transmitted: DL 01 AB 1234", Toast.LENGTH_SHORT).show()

        val tel = locationTracker.currentTelemetry
        eventSyncManager.dispatchIncidentEvent(
            deviceSessionId = activeSessionId,
            category = "ANPR_INCIDENT",
            confidence = testResult.confidence,
            lat = tel.latitude,
            lon = tel.longitude,
            plateText = testResult.registrationNumber,
            vehicleType = "CAR",
            speedKmh = tel.speedKmh,
            imageSnippetBase64 = null
        )
        autoTransmittedCount++
        binding.tvTripEvents.text = "Auto Transmitted: $autoTransmittedCount"
    }

    override fun onDestroy() {
        super.onDestroy()
        locationTracker.stopTracking()
        roadDetector.release()
        plateDetector.release()
        cameraExecutor.shutdown()
        plateExecutor.shutdown()
    }
}
