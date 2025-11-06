#!/usr/bin/env python3
"""
Faster-Whisper Transcription Script
Transcribes audio/video files to text using faster-whisper

Usage:
    python3 transcribe.py <audio_file_path> [model_size]

Arguments:
    audio_file_path: Path to audio/video file (WAV, MP3, MP4, etc.)
    model_size: Optional. Model size (tiny, base, small, medium, large-v2)
                Default: base

Output:
    Prints transcript to stdout

Requirements:
    pip install faster-whisper
"""

import sys
import os
import time
from faster_whisper import WhisperModel

def log(message):
    """Print to stderr so it doesn't interfere with stdout transcript"""
    print(f"[WHISPER] {message}", file=sys.stderr, flush=True)

def transcribe_audio(audio_path: str, model_size: str = "base"):
    """
    Transcribe audio file using Faster-Whisper

    Args:
        audio_path: Path to audio file
        model_size: Whisper model size (tiny, base, small, medium, large-v2)
                   - tiny: ~75MB, fastest, 32x realtime
                   - base: ~150MB, good balance (RECOMMENDED)
                   - small: ~500MB, better accuracy
                   - medium: ~1.5GB, high accuracy
                   - large-v2: ~3GB, best accuracy

    Returns:
        str: Transcribed text
    """

    # Validate file exists
    if not os.path.exists(audio_path):
        print(f"ERROR: File not found: {audio_path}", file=sys.stderr)
        sys.exit(1)

    # Get file size
    file_size_mb = os.path.getsize(audio_path) / (1024 * 1024)
    log(f"Starting transcription...")
    log(f"  Audio file: {audio_path}")
    log(f"  File size: {file_size_mb:.2f} MB")
    log(f"  Model: {model_size}")

    try:
        # Initialize model
        log(f"Loading Whisper model '{model_size}'... (may take 10-30s on first run)")
        start_load = time.time()

        # device: "cpu" or "cuda" (GPU)
        # compute_type: "int8" for CPU (faster), "float16" for GPU
        model = WhisperModel(
            model_size,
            device="cpu",
            compute_type="int8",
            download_root="./models/whisper"  # Cache models here
        )

        load_time = time.time() - start_load
        log(f"Model loaded in {load_time:.2f}s")

        # Transcribe
        log(f"Starting transcription... (this may take 1-5 minutes for 2 min audio)")
        start_transcribe = time.time()

        # language: "en" for English, None for auto-detect
        # beam_size: Higher = more accurate but slower (default: 5)
        # vad_filter: Voice Activity Detection to remove silence
        segments, info = model.transcribe(
            audio_path,
            language="en",  # Force English for better accuracy
            beam_size=5,
            vad_filter=True,  # Remove silence
            word_timestamps=False  # Set True if you need word-level timestamps
        )

        log(f"Transcription started. Language detected: {info.language} (probability: {info.language_probability:.2f})")
        log(f"Duration: {info.duration:.2f}s")
        log(f"Processing segments...")

        # Collect all segments
        transcript_parts = []
        segment_count = 0
        last_log_time = time.time()

        for segment in segments:
            transcript_parts.append(segment.text.strip())
            segment_count += 1

            # Log progress every 5 seconds or every 10 segments
            current_time = time.time()
            if current_time - last_log_time > 5 or segment_count % 10 == 0:
                elapsed = current_time - start_transcribe
                log(f"  Processed {segment_count} segments in {elapsed:.1f}s...")
                last_log_time = current_time

        transcribe_time = time.time() - start_transcribe
        log(f"Transcription completed! Processed {segment_count} segments in {transcribe_time:.2f}s")

        # Join with space
        transcript = " ".join(transcript_parts)

        log(f"Transcript length: {len(transcript)} characters, {len(transcript.split())} words")
        log(f"First 100 chars: {transcript[:100]}...")
        log(f"SUCCESS! Total time: {time.time() - start_load:.2f}s")

        # Print to stdout (NodeJS will capture this)
        print(transcript)

        # Return success
        return 0

    except Exception as e:
        log(f"ERROR: Transcription failed: {str(e)}")
        import traceback
        log(traceback.format_exc())
        sys.exit(1)

if __name__ == "__main__":
    log("=" * 60)
    log("Faster-Whisper Transcription Script")
    log("=" * 60)

    # Parse arguments
    if len(sys.argv) < 2:
        print("Usage: python3 transcribe.py <audio_file_path> [model_size]", file=sys.stderr)
        print("Example: python3 transcribe.py audio.wav base", file=sys.stderr)
        sys.exit(1)

    audio_path = sys.argv[1]
    model_size = sys.argv[2] if len(sys.argv) > 2 else "base"

    log(f"Arguments received:")
    log(f"  Audio path: {audio_path}")
    log(f"  Model size: {model_size}")

    # Validate model size
    valid_models = ["tiny", "base", "small", "medium", "large-v2"]
    if model_size not in valid_models:
        log(f"ERROR: Invalid model size '{model_size}'. Valid options: {', '.join(valid_models)}")
        sys.exit(1)

    # Run transcription
    exit_code = transcribe_audio(audio_path, model_size)
    log("=" * 60)
    sys.exit(exit_code)

