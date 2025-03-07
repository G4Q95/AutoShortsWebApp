# Auto Shorts Web App

A web application for automating the creation of short-form videos. This tool streamlines the process of creating engaging video content by automating several key steps.

## Features

- **Content Download**: Download images and videos from various sources
- **AI Text Rewriting**: Rewrite text using OpenAI's GPT models to make it more engaging
- **Voice Generation**: Convert text to speech using ElevenLabs' voice synthesis
- **Media Merging**: Combine images, text, and audio into short-form videos

## Requirements

- Python 3.8+
- ffmpeg (for video processing)
- API keys for:
  - OpenAI
  - ElevenLabs
  - Google Docs (for some features)

## Installation

1. Clone this repository:
   ```
   git clone https://github.com/G4Q95/AutoShortsWebApp.git
   cd AutoShortsWebApp
   ```

2. Create a virtual environment:
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows, use: venv\Scripts\activate
   ```

3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

4. Set up configuration:
   - Create a `.env` file in the `configs` directory
   - Add your API keys:
     ```
     OPENAI_API_KEY=your_openai_key
     ELEVENLABS_API_KEY=your_elevenlabs_key
     ```

## Usage

The application provides several command scripts in the `commands` directory:

- `download.command`: Download content
- `rewrite.command`: Rewrite text using AI
- `voice.command`: Generate voice narration from text
- `merge.command`: Combine media into videos

Double-click on these command files (on macOS) or run them from the terminal to use each feature.

## Directory Structure

```
Auto Shorts Web App/
├── commands/          # Command scripts to run features
├── configs/           # Configuration files and API keys
├── data/              # Data storage
│   ├── audio/         # Audio files
│   ├── images/        # Image files
│   ├── output/        # Output videos
│   └── temp/          # Temporary files
└── scripts/           # Python scripts
```

## License

MIT 