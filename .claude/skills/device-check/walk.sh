#!/usr/bin/env bash
# Fake a walk on the plugged phone through Appium Settings: one fix per second.
#
#   walk.sh line [--from LAT,LNG] [--bearing DEG] [--speed M/S] [--seconds N] [--accuracy M] [--ele M]
#   walk.sh gpx FILE [--speed M/S] [--accuracy M]
#   walk.sh stop
#
# `line` walks straight from --from (default Place du Capitole, Toulouse); --speed 0 stands still.
# `gpx` walks the file's track points in order at --speed, altitude taken from <ele>.
# The mock is stopped on every exit, so the phone returns to real GPS.
set -euo pipefail

SERVICE=io.appium.settings/.LocationService
from=43.60445,1.44345 bearing=45 speed=1.4 seconds=60 accuracy=4 ele=146

stop_mock() { adb shell am stopservice "$SERVICE" >/dev/null 2>&1 || true; }

preflight() {
  adb get-state >/dev/null 2>&1 || { echo "no device attached" >&2; exit 1; }
  adb shell pm path io.appium.settings >/dev/null 2>&1 || { echo "Appium Settings not installed (see SKILL.md, Phone setup)" >&2; exit 1; }
  adb shell appops get io.appium.settings android:mock_location | grep -q allow ||
    { echo "Appium Settings lacks mock_location (see SKILL.md, Phone setup)" >&2; exit 1; }
}

# Prints one "lat lng ele bearing" line per second of walk.
line_fixes() {
  awk -v from="$from" -v brg="$bearing" -v v="$speed" -v n="$seconds" -v ele="$ele" 'BEGIN {
    split(from, p, ","); r = 3.14159265 / 180
    for (i = 0; i <= n; i++) {
      d = v * i
      printf "%.7f %.7f %.1f %.1f\n", p[1] + d * cos(brg * r) / 111320, p[2] + d * sin(brg * r) / (111320 * cos(p[1] * r)), ele, brg
    }
  }'
}

gpx_fixes() {
  awk -v v="$speed" 'BEGIN { RS = "<trkpt"; r = 3.14159265 / 180 }
    NR > 1 {
      match($0, /lat="[^"]+"/); la = substr($0, RSTART + 5, RLENGTH - 6)
      match($0, /lon="[^"]+"/); lo = substr($0, RSTART + 5, RLENGTH - 6)
      e = ""; if (match($0, /<ele>[^<]+</)) e = substr($0, RSTART + 5, RLENGTH - 6)
      n++; lat[n] = la; lng[n] = lo; el[n] = e
    }
    function dist(a, b,   dy, dx) {
      dy = (lat[b] - lat[a]) * 111320; dx = (lng[b] - lng[a]) * 111320 * cos(lat[a] * r)
      return sqrt(dx * dx + dy * dy)
    }
    function brg(a, b,   dy, dx, t) {
      dy = lat[b] - lat[a]; dx = (lng[b] - lng[a]) * cos(lat[a] * r)
      t = atan2(dx, dy) / r; return t < 0 ? t + 360 : t
    }
    END {
      if (n < 2 || v <= 0) { print "need >= 2 track points and --speed > 0" > "/dev/stderr"; exit 1 }
      seg = 1; acc = 0; len = dist(1, 2)
      for (t = 0; ; t++) {
        d = v * t
        while (seg < n && d > acc + len) { acc += len; seg++; if (seg < n) len = dist(seg, seg + 1) }
        if (seg >= n) break
        f = len > 0 ? (d - acc) / len : 0
        e = (el[seg] != "" && el[seg + 1] != "") ? sprintf("%.1f", el[seg] + f * (el[seg + 1] - el[seg])) : "-"
        printf "%.7f %.7f %s %.1f\n", lat[seg] + f * (lat[seg + 1] - lat[seg]), lng[seg] + f * (lng[seg + 1] - lng[seg]), e, brg(seg, seg + 1)
      }
      printf "%.7f %.7f %s %.1f\n", lat[n], lng[n], (el[n] != "" ? el[n] : "-"), brg(n - 1, n)
    }' "$1"
}

send_fixes() {
  local start i=0 lat lng e b extra wait_ms
  start=$(date +%s%3N)
  while read -r lat lng e b; do
    extra=(--es accuracy "$accuracy")
    [ "$e" != "-" ] && extra+=(--es altitude "$e")
    awk -v s="$speed" 'BEGIN { exit !(s > 0) }' && extra+=(--es speed "$speed" --es bearing "$b")
    adb shell am start-foreground-service --user 0 -n "$SERVICE" --es latitude "$lat" --es longitude "$lng" "${extra[@]}" </dev/null >/dev/null
    i=$((i + 1))
    wait_ms=$((start + i * 1000 - $(date +%s%3N)))
    [ "$wait_ms" -gt 0 ] && sleep "$(awk -v m="$wait_ms" 'BEGIN { printf "%.3f", m / 1000 }')"
  done
  echo "walk done: $i fixes"
}

mode=${1:-}; shift || true
case "$mode" in
  stop) stop_mock; exit 0 ;;
  line) ;;
  gpx) gpx=${1:?gpx FILE}; shift ;;
  *) sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
while [ $# -gt 0 ]; do
  case "$1" in
    --from) from=$2 ;; --bearing) bearing=$2 ;; --speed) speed=$2 ;;
    --seconds) seconds=$2 ;; --accuracy) accuracy=$2 ;; --ele) ele=$2 ;;
    *) echo "unknown option $1" >&2; exit 1 ;;
  esac
  shift 2
done

preflight
trap stop_mock EXIT
trap 'exit 130' INT TERM
if [ "$mode" = line ]; then send_fixes < <(line_fixes); else send_fixes < <(gpx_fixes "$gpx"); fi
