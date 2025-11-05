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
from faster_whisper import WhisperModel

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

    try:
        # Initialize model
        # device: "cpu" or "cuda" (GPU)
        # compute_type: "int8" for CPU (faster), "float16" for GPU
        model = WhisperModel(
            model_size,
            device="cpu",
            compute_type="int8",
            download_root="./models/whisper"  # Cache models here
        )

        # Transcribe
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

        # Collect all segments
        transcript_parts = []
        for segment in segments:
            transcript_parts.append(segment.text.strip())

        # Join with space
        transcript = " ".join(transcript_parts)

        # Print to stdout (NodeJS will capture this)
        print(transcript)

        # Return success
        return 0

    except Exception as e:
        print(f"ERROR: Transcription failed: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    # Parse arguments
    if len(sys.argv) < 2:
        print("Usage: python3 transcribe.py <audio_file_path> [model_size]", file=sys.stderr)
        print("Example: python3 transcribe.py audio.wav base", file=sys.stderr)
        sys.exit(1)

    audio_path = sys.argv[1]
    model_size = sys.argv[2] if len(sys.argv) > 2 else "base"

    # Validate model size
    valid_models = ["tiny", "base", "small", "medium", "large-v2"]
    if model_size not in valid_models:
        print(f"ERROR: Invalid model size '{model_size}'. Valid options: {', '.join(valid_models)}", file=sys.stderr)
        sys.exit(1)

    # Run transcription
    sys.exit(transcribe_audio(audio_path, model_size))

