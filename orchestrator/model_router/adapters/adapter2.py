<<<<<<< HEAD
import os

import requests


class TogetherAdapterError(Exception):
    """Raised on any Together call failure - network, HTTP, or malformed response."""


class TogetherAdapter:
    def __init__(self):
        self._api_key = None

    def _get_api_key(self) -> str:
        if self._api_key is None:
            key = os.environ.get("TOGETHER_API_KEY")
            if not key:
                raise TogetherAdapterError("TOGETHER_API_KEY is not set")
            self._api_key = key
        return self._api_key

    def complete(self, prompt: str, model: str, max_tokens: int = 1024, **kwargs) -> dict:
        """Returns {"text": str, "input_tokens": int, "output_tokens": int} - same shape as GroqAdapter/GeminiAdapter."""
        try:
            response = requests.post(
                "https://api.together.xyz/v1/chat/completions",
                headers={"Authorization": f"Bearer {self._get_api_key()}"},
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": max_tokens,
                    **kwargs,
                },
                timeout=30,
            )
            response.raise_for_status()
            data = response.json()
            return {
                "text": data["choices"][0]["message"]["content"],
                "input_tokens": data["usage"]["prompt_tokens"],
                "output_tokens": data["usage"]["completion_tokens"],
            }
        except requests.RequestException as e:
            raise TogetherAdapterError(f"Together request failed: {e}") from e
        except (KeyError, IndexError) as e:
=======
import os

import requests


class TogetherAdapterError(Exception):
    """Raised on any Together call failure - network, HTTP, or malformed response."""


class TogetherAdapter:
    def __init__(self):
        self._api_key = None

    def _get_api_key(self) -> str:
        if self._api_key is None:
            key = os.environ.get("TOGETHER_API_KEY")
            if not key:
                raise TogetherAdapterError("TOGETHER_API_KEY is not set")
            self._api_key = key
        return self._api_key

    def complete(self, prompt: str, model: str, max_tokens: int = 1024, **kwargs) -> dict:
        """Returns {"text": str, "input_tokens": int, "output_tokens": int} - same shape as GroqAdapter/GeminiAdapter."""
        try:
            response = requests.post(
                "https://api.together.xyz/v1/chat/completions",
                headers={"Authorization": f"Bearer {self._get_api_key()}"},
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": max_tokens,
                    **kwargs,
                },
                timeout=30,
            )
            response.raise_for_status()
            data = response.json()
            return {
                "text": data["choices"][0]["message"]["content"],
                "input_tokens": data["usage"]["prompt_tokens"],
                "output_tokens": data["usage"]["completion_tokens"],
            }
        except requests.RequestException as e:
            raise TogetherAdapterError(f"Together request failed: {e}") from e
        except (KeyError, IndexError) as e:
>>>>>>> 17d14f619ee27a032db336356d927b1b42009a91
            raise TogetherAdapterError(f"Together returned an unexpected response shape: {e}") from e