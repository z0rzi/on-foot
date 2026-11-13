# Renders the overview pin images beside this file (all but overview-pin-tag.png):
# `python3 overview-pins.py`. Teardrop canvas 60x75 px at 3 px/dp: tip (30,72), head centre
# 14 dp above it, radius 8 dp. SDF images: white, alpha = 0.75 at the edge, falling 0.1 per px outward.
import math, os, struct, zlib

OUT = os.path.dirname(os.path.abspath(__file__))
K = 3
W, H = 60, 75
TIP = (30.0, 72.0)
C = (30.0, 72.0 - 14 * K)
R = 8 * K


def clamp(v, a=0.0, b=1.0):
    return max(a, min(b, v))


def sd_circle(px, py, cx, cy, r):
    return math.hypot(px - cx, py - cy) - r


def sd_tear(px, py):
    # circle of radius R at C, plus the two tangents from the tip
    d_circle = sd_circle(px, py, C[0], C[1], R)
    D = TIP[1] - C[1]
    half = math.asin(R / D)
    # distance to the cone (apex TIP, axis up, half-angle `half`), only on the cone side
    x, y = abs(px - TIP[0]), TIP[1] - py
    # rotate into the cone's frame
    q_along = y * math.cos(half) + x * math.sin(half)
    q_perp = x * math.cos(half) - y * math.sin(half)
    tangent_len = math.sqrt(D * D - R * R)
    if q_along < 0:
        d_cone = math.hypot(x, y)
    elif q_along > tangent_len:
        d_cone = d_circle
    else:
        d_cone = q_perp
    return min(d_circle, d_cone)


def png(name, w, h, pixel):
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        for x in range(w):
            raw += bytes(round(clamp(c) * 255) for c in pixel(x + 0.5, y + 0.5))
    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d))
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)) + \
        chunk(b'IDAT', zlib.compress(bytes(raw), 9)) + chunk(b'IEND', b'')
    open(f'{OUT}/{name}.png', 'wb').write(data)


def sdf(sd):
    return lambda px, py: (1, 1, 1, 0.75 - 0.1 * sd(px, py))


png('overview-pin-outline', W, H, sdf(sd_tear))
png('overview-pin-body', W, H, sdf(lambda px, py: sd_tear(px, py) + 1.5 * K))
png('overview-pin-centre', W, H, sdf(lambda px, py: sd_circle(px, py, C[0], C[1], 4 * K)))
png('overview-pin-shadow', W, H, lambda px, py: (0, 0, 0, 0.35 * clamp(0.5 - sd_tear(px, py - 1.0 * K) / (1.5 * K))))
png('overview-pin-room', 8 * K, 22 * K, lambda px, py: (0, 0, 0, 0))


# The completed trail's body split down through the tip: the right half is drawn over the left, which
# runs 1.5 px past the axis, the width of their antialiased edge, so no border shows between them.
def sd_body(px, py):
    return sd_tear(px, py) + 1.5 * K


png('overview-pin-body-left', W, H, sdf(lambda px, py: max(sd_body(px, py), px - TIP[0] - 1.5)))
png('overview-pin-body-right', W, H, sdf(lambda px, py: max(sd_body(px, py), TIP[0] - px)))
