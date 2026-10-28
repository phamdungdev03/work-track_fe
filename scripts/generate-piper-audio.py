"""Create offline demo speech with Piper. Install piper-tts and supply --model.

Generated files are written to a staging directory; copy them to public/audio
only after listening to samples and verifying the full batch.
"""
import argparse
import ast
from pathlib import Path
import wave

from piper import PiperVoice


def demo_phrases():
    # Reuse the same message catalogue as the existing offline generator.
    source = Path(__file__).with_name('generate-demo-audio.py').read_text(encoding='utf-8')
    module = ast.parse(source)
    assignment = next(node for node in module.body if isinstance(node, ast.Assign)
                      and any(isinstance(target, ast.Name) and target.id == 'clips' for target in node.targets))
    phrases = ast.literal_eval(assignment.value)
    for number in range(1, 101):
        name = f'Nhân viên Demo {number:03}'
        phrases[f'IN-{number:03}'] = f'Xin chào {name}, mời vào.'
        phrases[f'OUT-{number:03}'] = f'Xin tạm biệt {name}.'
    return phrases


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--model', required=True, type=Path, help='Path to Piper .onnx model and adjacent .onnx.json')
    parser.add_argument('--output', required=True, type=Path, help='Staging directory for generated WAV files')
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    voice = PiperVoice.load(args.model)
    phrases = demo_phrases()
    for index, (key, phrase) in enumerate(phrases.items(), 1):
        with wave.open(str(args.output / f'{key}.wav'), 'wb') as output:
            voice.synthesize_wav(phrase, output)
        if index % 25 == 0 or index == len(phrases):
            print(f'{index}/{len(phrases)}', flush=True)


if __name__ == '__main__':
    main()
