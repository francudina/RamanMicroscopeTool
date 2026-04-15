from __future__ import annotations

import io

import numpy as np
from PIL import Image

from models import FreeformParams, Point, SampleShape, ShapeType


def detect_sample_boundary(
    image_data: bytes,
    width_um: float,
    height_um: float,
) -> SampleShape:
    """
    Detect sample boundary from an uploaded image using simple thresholding.

    Converts to grayscale, thresholds to separate sample from background,
    finds the bounding region of detected pixels, and returns a freeform
    polygon (axis-aligned rectangle) in micron coordinates.
    """
    img = Image.open(io.BytesIO(image_data)).convert("L")  # grayscale
    arr = np.array(img, dtype=np.float32)

    img_h, img_w = arr.shape

    # --- thresholding ---
    # Assume dark sample on light background (common for transmitted light).
    # If mean > 128 the background is likely light; invert otherwise.
    mean_val = float(arr.mean())
    if mean_val > 128:
        binary = arr < (mean_val * 0.75)   # dark region = sample
    else:
        binary = arr > (mean_val * 1.25)   # light region = sample

    rows_with_signal = np.any(binary, axis=1)
    cols_with_signal = np.any(binary, axis=0)

    if not rows_with_signal.any() or not cols_with_signal.any():
        # Fallback: use the full image extent
        y_px_min, y_px_max = 0, img_h - 1
        x_px_min, x_px_max = 0, img_w - 1
    else:
        y_px_min, y_px_max = int(np.where(rows_with_signal)[0][[0, -1]])  # type: ignore[index]
        x_px_min, x_px_max = int(np.where(cols_with_signal)[0][[0, -1]])  # type: ignore[index]

    # --- pixel → micron mapping ---
    scale_x = width_um / img_w
    scale_y = height_um / img_h

    x_min_um = x_px_min * scale_x
    y_min_um = y_px_min * scale_y
    x_max_um = x_px_max * scale_x
    y_max_um = y_px_max * scale_y

    return SampleShape(
        type=ShapeType.FREEFORM,
        freeform=FreeformParams(
            points=[
                Point(x=x_min_um, y=y_min_um),
                Point(x=x_max_um, y=y_min_um),
                Point(x=x_max_um, y=y_max_um),
                Point(x=x_min_um, y=y_max_um),
            ]
        ),
    )
