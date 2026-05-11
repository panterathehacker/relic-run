"""Generate a World Labs world from a text prompt."""

import json
import os
import sys
import time
from urllib import request, error


# Get World Labs API key from environment variable
WLT_API_KEY = os.environ.get("WLT_API_KEY")
if not WLT_API_KEY:
    print("Please set environment variable WLT_API_KEY to your World Labs API key")
    sys.exit(1)

API_BASE_URL = "https://api.worldlabs.ai/marble/v1"


def api_fetch(path, method="GET", body=None, headers=None):
    """Send an API request and parse JSON response."""
    url = f"{API_BASE_URL}/{path}"
    payload = json.dumps(body).encode("utf-8") if body is not None else None
    req_headers = {"WLT-Api-Key": WLT_API_KEY, "Content-Type": "application/json"}
    if headers:
        req_headers.update(headers)
    req = request.Request(url, data=payload, headers=req_headers, method=method)
    try:
        with request.urlopen(req) as response:
            response_body = response.read().decode("utf-8")
            return json.loads(response_body) if response_body else {}
    except error.HTTPError as exc:
        response_body = exc.read().decode("utf-8")
        raise RuntimeError(
            f"{path}: {exc.code} {response_body}"
        ) from exc


def generate_world(text_prompt, auto_enhance, draft, seed):
    """Start a world generation operation from text."""
    if not text_prompt:
        raise RuntimeError("Enter a text prompt first.")

    world_prompt = {
        "type": "text",
        "text_prompt": text_prompt,
        "disable_recaption": not auto_enhance,
    }
    operation = api_fetch(
        "worlds:generate",
        method="POST",
        body={
            "world_prompt": world_prompt,
            "model": "Marble 0.1-mini" if draft else "Marble 0.1-plus",
            "seed": seed,
        },
    )
    return operation["operation_id"]


def get_operation(operation_id):
    """Fetch operation status by ID."""
    return api_fetch(f"operations/{operation_id}")


def get_world(world_id):
    """Fetch world details by ID."""
    return api_fetch(f"worlds/{world_id}")


def main():
    """Run the CLI flow for text-based generation."""
    if len(sys.argv) < 2:
        print("Usage: python generate-world-from-text.py 'prompt' [--plus]")
        sys.exit(1)

    text_prompt = sys.argv[1]
    auto_enhance = True
    draft = "--plus" not in sys.argv  # --plus flag uses Marble 0.1-plus (high quality)
    seed = None

    operation_id = generate_world(text_prompt, auto_enhance, draft, seed)
    print(f'Submitted world generation for "{text_prompt}"', {"operationId": operation_id})

    operation = None
    while True:
        operation = get_operation(operation_id)
        if operation.get("done"):
            break
        print(f"Operation {operation_id} still processing")
        time.sleep(5)

    world_id = operation["response"]["world_id"]
    world = get_world(world_id)
    print("World", json.dumps(world, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
