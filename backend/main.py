from __future__ import annotations

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from image_processor import detect_sample_boundary
from models import (
    ImageDetectionResult,
    ScanRequest,
    ScanResult,
    StageConstraints,
)
from scan_generator import generate_scan_grid, get_bounding_box

app = FastAPI(
    title="DXR3 Raman Scan Planner API",
    version="1.0.0",
    description="Computes DXR3-ready scan grid parameters from sample shape and step settings.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health ─────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok"}


# ── Scan endpoints ─────────────────────────────────────────────────────────────

@app.post("/api/scan/generate", response_model=ScanResult, tags=["scan"])
def generate_scan(request: ScanRequest) -> ScanResult:
    """
    Full scan-grid computation.

    Returns start point, ΔX/ΔY, Nx/Ny for each pass, plus the filtered
    list of grid points that fall inside the sample shape.
    """
    try:
        return generate_scan_grid(request.shape, request.scan_params, request.stage)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Scan generation failed: {exc}") from exc


@app.post("/api/scan/validate", tags=["scan"])
def validate_scan(request: ScanRequest) -> dict:
    """
    Quick validation — returns approximate point count and warnings without
    computing the full point list.
    """
    warnings: list[str] = []

    try:
        bounds = get_bounding_box(request.shape)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    x_min, y_min, x_max, y_max = bounds
    width = x_max - x_min
    height = y_max - y_min

    eff_step_x = request.scan_params.step_x * (1.0 - request.scan_params.overlap)
    eff_step_y = request.scan_params.step_y * (1.0 - request.scan_params.overlap)

    valid = True
    if eff_step_x <= 0 or eff_step_y <= 0:
        warnings.append("Effective step size must be positive — reduce overlap.")
        valid = False

    nx_approx = max(1, int(width / eff_step_x) + 1) if eff_step_x > 0 else 0
    ny_approx = max(1, int(height / eff_step_y) + 1) if eff_step_y > 0 else 0
    total_approx = nx_approx * ny_approx

    stage = request.stage
    exceeds_stage = width > stage.max_scan_width or height > stage.max_scan_height

    if exceeds_stage:
        from math import ceil
        cols = ceil(width / stage.max_scan_width)
        rows = ceil(height / stage.max_scan_height)
        warnings.append(
            f"Area exceeds stage limits — will be split into {cols * rows} passes."
        )

    if total_approx > 50_000:
        warnings.append(f"Very large scan: ~{total_approx:,} points.")
    elif total_approx > 10_000:
        warnings.append(f"Large scan: ~{total_approx:,} points.")

    if request.scan_params.step_x < 1.0 or request.scan_params.step_y < 1.0:
        warnings.append("Step size < 1 µm — may exceed hardware precision.")

    return {
        "valid": valid,
        "warnings": warnings,
        "approx_points": total_approx,
        "exceeds_stage": exceeds_stage,
        "bounding_box_um": {"width": round(width, 2), "height": round(height, 2)},
    }


# ── Image detection ────────────────────────────────────────────────────────────

@app.post("/api/image/detect", response_model=ImageDetectionResult, tags=["image"])
async def detect_image(
    file: UploadFile = File(...),
    width_um: float = Form(..., description="Physical width of image in µm"),
    height_um: float = Form(..., description="Physical height of image in µm"),
) -> ImageDetectionResult:
    """
    Upload a sample image; returns a detected boundary as a SampleShape
    (freeform polygon in micron coordinates).
    """
    try:
        image_data = await file.read()
        shape = detect_sample_boundary(image_data, width_um, height_um)
        return ImageDetectionResult(
            detected_shape=shape,
            confidence=0.75,
            preview_bounds={"width": width_um, "height": height_um},
        )
    except Exception as exc:
        raise HTTPException(
            status_code=422, detail=f"Image processing failed: {exc}"
        ) from exc
