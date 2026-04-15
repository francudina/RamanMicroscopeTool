from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, field_validator


class ShapeType(str, Enum):
    RECTANGLE = "rectangle"
    CIRCLE = "circle"
    FREEFORM = "freeform"


class Point(BaseModel):
    x: float  # microns
    y: float  # microns


class RectParams(BaseModel):
    x: float       # top-left corner X, microns
    y: float       # top-left corner Y, microns
    width: float   # microns
    height: float  # microns

    @field_validator("width", "height")
    @classmethod
    def must_be_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("width and height must be positive")
        return v


class CircleParams(BaseModel):
    cx: float     # center X, microns
    cy: float     # center Y, microns
    radius: float  # microns

    @field_validator("radius")
    @classmethod
    def must_be_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("radius must be positive")
        return v


class FreeformParams(BaseModel):
    points: List[Point]  # polygon vertices in microns (closed automatically)

    @field_validator("points")
    @classmethod
    def need_at_least_three(cls, v: List[Point]) -> List[Point]:
        if len(v) < 3:
            raise ValueError("freeform shape needs at least 3 points")
        return v


class SampleShape(BaseModel):
    type: ShapeType
    rect: Optional[RectParams] = None
    circle: Optional[CircleParams] = None
    freeform: Optional[FreeformParams] = None


class ScanParameters(BaseModel):
    step_x: float          # µm — ΔX
    step_y: float          # µm — ΔY
    overlap: float = 0.0   # fraction 0.0–0.5

    @field_validator("step_x", "step_y")
    @classmethod
    def must_be_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("step sizes must be positive")
        return v

    @field_validator("overlap")
    @classmethod
    def overlap_range(cls, v: float) -> float:
        if not (0.0 <= v < 1.0):
            raise ValueError("overlap must be in [0.0, 1.0)")
        return v


class StageConstraints(BaseModel):
    max_scan_width: float = 25_000.0    # µm (25 mm default)
    max_scan_height: float = 25_000.0   # µm (25 mm default)
    time_per_point_seconds: float = 5.0


class ScanRequest(BaseModel):
    shape: SampleShape
    scan_params: ScanParameters
    stage: StageConstraints = StageConstraints()


# ── Output models ──────────────────────────────────────────────────────────────

class ScanPass(BaseModel):
    pass_number: int
    region: dict               # {x_min, y_min, x_max, y_max} in µm
    start_point: Point         # (X, Y) — value to enter in DXR3
    delta_x: float             # ΔX — value to enter in DXR3
    delta_y: float             # ΔY — value to enter in DXR3
    nx: int                    # Nx — value to enter in DXR3
    ny: int                    # Ny — value to enter in DXR3
    total_points: int          # actual filtered point count
    area_mm2: float
    grid_points: List[Point]   # filtered scan points (inside shape)


class ScanResult(BaseModel):
    passes: List[ScanPass]
    total_points: int
    total_area_mm2: float
    warnings: List[str]
    estimated_time_minutes: float
    requires_multiple_passes: bool


class ImageDetectionResult(BaseModel):
    detected_shape: SampleShape
    confidence: float
    preview_bounds: dict       # {width, height} in µm for display
