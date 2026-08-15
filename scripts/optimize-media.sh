#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
TASK_MEDIA_TMP=$(mktemp -d)

cleanup() {
  find "$TASK_MEDIA_TMP" -type f -delete
  rmdir "$TASK_MEDIA_TMP"
}
trap cleanup EXIT

cd "$ROOT_DIR"

require_tool() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Required tool not found: $1" >&2
    exit 1
  fi
}

require_tool ffmpeg
require_tool jpegtran
require_tool magick

fast_start_mp4() {
  local media_path=$1
  local media_name candidate_path moov_offset mdat_offset original_hash candidate_hash
  media_name=$(basename "$media_path")
  candidate_path="$TASK_MEDIA_TMP/$media_name"
  moov_offset=$(LC_ALL=C grep -aob -m1 "moov" "$media_path" | cut -d: -f1)
  mdat_offset=$(LC_ALL=C grep -aob -m1 "mdat" "$media_path" | cut -d: -f1)

  if (( moov_offset < mdat_offset )); then
    echo "Already stream-ready: $media_path"
    return
  fi

  ffmpeg -v error -i "$media_path" -map 0 -c copy -movflags +faststart "$candidate_path"
  original_hash=$(ffmpeg -v error -i "$media_path" -map 0:v:0 -c copy -f hash -hash sha256 - | cut -d= -f2)
  candidate_hash=$(ffmpeg -v error -i "$candidate_path" -map 0:v:0 -c copy -f hash -hash sha256 - | cut -d= -f2)

  if [[ "$original_hash" != "$candidate_hash" ]]; then
    echo "Rejected $media_path: compressed video data changed" >&2
    exit 1
  fi

  mv "$candidate_path" "$media_path"
  echo "Enabled fast-start without re-encoding: $media_path"
}

optimize_jpeg() {
  local image_path=$1
  local image_name candidate_path differing_pixels original_size candidate_size
  image_name=$(basename "$image_path")
  candidate_path="$TASK_MEDIA_TMP/$image_name"
  jpegtran -copy all -optimize -progressive -outfile "$candidate_path" "$image_path"
  differing_pixels=$(magick compare -metric AE "$image_path" "$candidate_path" null: 2>&1)
  original_size=$(stat -f "%z" "$image_path")
  candidate_size=$(stat -f "%z" "$candidate_path")

  if [[ "$differing_pixels" != "0" ]]; then
    echo "Rejected $image_path: decoded pixels changed" >&2
    exit 1
  fi

  if (( candidate_size < original_size )); then
    mv "$candidate_path" "$image_path"
    echo "Losslessly optimized $image_path: $original_size -> $candidate_size bytes"
  else
    echo "Already optimized: $image_path"
  fi
}

create_static_gif() {
  local source_path=$1
  local output_path=$2
  local differing_pixels
  magick "${source_path}[0]" -strip "$output_path"
  differing_pixels=$(magick compare -metric AE "${source_path}[0]" "${output_path}[0]" null: 2>&1)

  if [[ "$differing_pixels" != "0" ]]; then
    echo "Rejected $output_path: first-frame pixels changed" >&2
    exit 1
  fi

  echo "Created motion-safe first frame: $output_path"
}

for media_path in \
  assets/img/flappy_high.mp4 \
  assets/img/pick.mp4 \
  assets/img/stretch_moving.mp4; do
  fast_start_mp4 "$media_path"
done

for image_path in \
  assets/img/Italy_Max.jpeg \
  assets/img/cmr_op.jpg \
  assets/img/cmr_rover.jpg \
  assets/img/cmr_team.jpg \
  assets/img/cmr_team_sci.jpg \
  assets/img/cmr_fixing.jpg; do
  optimize_jpeg "$image_path"
done

create_static_gif assets/img/apricot.gif assets/img/apricot-still.gif
create_static_gif assets/img/mosaic.gif assets/img/mosaic-still.gif
