from __future__ import annotations

from math import ceil, floor
from typing import List, Tuple

from models import (
    CircleParams,
    FreeformParams,
    Point,
    RectParams,
    SampleShape,
    ScanParameters,
    ScanPass,
    ScanResult,
    ShapeType,
    StageConstraints,
)

# ── Bounding box ───────────────────────────────────────────────────────────────

def get_bounding_box(shape: SampleShape) -> Tuple[float, float, float, float]:
    """Return (x_min, y_min, x_max, y_max) in microns."""
    if shape.type == ShapeType.RECTANGLE and shape.rect:
        r = shape.rect
        return (r.x, r.y, r.x + r.width, r.y + r.height)
    if shape.type == ShapeType.CIRCLE and shape.circle:
        c = shape.circle
        return (c.cx - c.radius, c.cy - c.radius, c.cx + c.radius, c.cy + c.radius)
    if shape.type == ShapeType.FREEFORM and shape.freeform:
        pts = shape.freeform.points
        xs = [p.x for p in pts]
        ys = [p.y for p in pts]
        return (min(xs), min(ys), max(xs), max(ys))
    raise ValueError(f"Unsupported or incomplete shape: {shape.type}")


# ── Point containment tests ────────────────────────────────────────────────────

def _in_rect(x: float, y: float, r: RectParams) -> bool:
    return r.x <= x <= r.x + r.width and r.y <= y <= r.y + r.height


def _in_circle(x: float, y: float, c: CircleParams) -> bool:
    return (x - c.cx) ** 2 + (y - c.cy) ** 2 <= c.radius ** 2


def _in_polygon(x: float, y: float, pts: List[Point]) -> bool:
    """Ray-casting (even-odd rule)."""
    n = len(pts)
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = pts[i].x, pts[i].y
        xj, yj = pts[j].x, pts[j].y
        if (yi > y) != (yj > y):
            intersect_x = (xj - xi) * (y - yi) / (yj - yi) + xi
            if x < intersect_x:
                inside = not inside
        j = i
    return inside


def _point_in_shape(x: float, y: float, shape: SampleShape) -> bool:
    if shape.type == ShapeType.RECTANGLE and shape.rect:
        return _in_rect(x, y, shape.rect)
    if shape.type == ShapeType.CIRCLE and shape.circle:
        return _in_circle(x, y, shape.circle)
    if shape.type == ShapeType.FREEFORM and shape.freeform:
        return _in_polygon(x, y, shape.freeform.points)
    return False


# ── Region splitting ───────────────────────────────────────────────────────────

def _split_region(
    bounds: Tuple[float, float, float, float],
    max_w: float,
    max_h: float,
) -> List[Tuple[float, float, float, float]]:
    """Tile a large bounding box into stage-sized regions."""
    x_min, y_min, x_max, y_max = bounds
    cols = ceil((x_max - x_min) / max_w)
    rows = ceil((y_max - y_min) / max_h)
    tiles = []
    for row in range(rows):
        for col in range(cols):
            tx_min = x_min + col * max_w
            ty_min = y_min + row * max_h
            tx_max = min(tx_min + max_w, x_max)
            ty_max = min(ty_min + max_h, y_max)
            tiles.append((tx_min, ty_min, tx_max, ty_max))
    return tiles


# ── Single pass generation ─────────────────────────────────────────────────────

def _generate_pass(
    pass_number: int,
    region: Tuple[float, float, float, float],
    eff_step_x: float,
    eff_step_y: float,
    shape: SampleShape,
) -> ScanPass:
    x_min, y_min, x_max, y_max = region

    # Grid dimensions for this region
    nx = max(1, int(floor((x_max - x_min) / eff_step_x)) + 1)
    ny = max(1, int(floor((y_max - y_min) / eff_step_y)) + 1)

    # Trim if the last step would overshoot the region
    if nx > 1 and x_min + (nx - 1) * eff_step_x > x_max + 1e-9:
        nx -= 1
    if ny > 1 and y_min + (ny - 1) * eff_step_y > y_max + 1e-9:
        ny -= 1

    # Build filtered point list
    grid_points: List[Point] = []
    for j in range(ny):
        for i in range(nx):
            px = x_min + i * eff_step_x
            py = y_min + j * eff_step_y
            if _point_in_shape(px, py, shape):
                grid_points.append(Point(x=round(px, 4), y=round(py, 4)))

    span_x = (nx - 1) * eff_step_x if nx > 1 else 0.0
    span_y = (ny - 1) * eff_step_y if ny > 1 else 0.0
    area_mm2 = (span_x / 1_000) * (span_y / 1_000)

    return ScanPass(
        pass_number=pass_number,
        region={
            "x_min": round(x_min, 4),
            "y_min": round(y_min, 4),
            "x_max": round(x_max, 4),
            "y_max": round(y_max, 4),
        },
        start_point=Point(x=round(x_min, 4), y=round(y_min, 4)),
        delta_x=round(eff_step_x, 4),
        delta_y=round(eff_step_y, 4),
        nx=nx,
        ny=ny,
        total_points=len(grid_points),
        area_mm2=round(area_mm2, 6),
        grid_points=grid_points,
    )


# ── Public entry point ─────────────────────────────────────────────────────────

def generate_scan_grid(
    shape: SampleShape,
    scan_params: ScanParameters,
    stage: StageConstraints,
) -> ScanResult:
    warnings: List[str] = []

    eff_step_x = scan_params.step_x * (1.0 - scan_params.overlap)
    eff_step_y = scan_params.step_y * (1.0 - scan_params.overlap)

    if eff_step_x <= 0 or eff_step_y <= 0:
        raise ValueError("Effective step size must be positive (reduce overlap)")

    if scan_params.step_x < 1.0 or scan_params.step_y < 1.0:
        warnings.append(
            "Step size < 1 µm — may exceed hardware positioning precision."
        )

    bounds = get_bounding_box(shape)
    x_min, y_min, x_max, y_max = bounds
    total_w = x_max - x_min
    total_h = y_max - y_min

    needs_split = (
        total_w > stage.max_scan_width or total_h > stage.max_scan_height
    )

    if needs_split:
        cols = ceil(total_w / stage.max_scan_width)
        rows = ceil(total_h / stage.max_scan_height)
        warnings.append(
            f"Sample area ({total_w/1_000:.2f} mm × {total_h/1_000:.2f} mm) exceeds "
            f"stage scan limit ({stage.max_scan_width/1_000:.0f} mm × "
            f"{stage.max_scan_height/1_000:.0f} mm). "
            f"Scan split into {cols * rows} passes ({cols} col × {rows} row). "
            "Reposition the stage between passes."
        )
        regions = _split_region(bounds, stage.max_scan_width, stage.max_scan_height)
    else:
        regions = [bounds]

    passes: List[ScanPass] = []
    for i, region in enumerate(regions):
        scan_pass = _generate_pass(i + 1, region, eff_step_x, eff_step_y, shape)
        passes.append(scan_pass)

    total_points = sum(p.total_points for p in passes)
    total_area_mm2 = sum(p.area_mm2 for p in passes)

    if total_points == 0:
        warnings.append(
            "No scan points generated — check that the shape is valid and step size "
            "is smaller than the sample dimensions."
        )
    elif total_points > 50_000:
        warnings.append(
            f"Very large scan: {total_points:,} points. This will take a very long time."
        )
    elif total_points > 10_000:
        warnings.append(
            f"Large scan: {total_points:,} points. Estimated long scan time."
        )

    estimated_time_min = (total_points * stage.time_per_point_seconds) / 60.0

    return ScanResult(
        passes=passes,
        total_points=total_points,
        total_area_mm2=round(total_area_mm2, 6),
        warnings=warnings,
        estimated_time_minutes=round(estimated_time_min, 1),
        requires_multiple_passes=len(passes) > 1,
    )
