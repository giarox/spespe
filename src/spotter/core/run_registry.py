import hashlib
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List

from supabase import create_client


def _hash_file(path: str) -> str:
    hasher = hashlib.sha256()
    with open(path, "rb") as file:
        for chunk in iter(lambda: file.read(8192), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def get_latest_run(
    supabase_url: str,
    supabase_key: str,
    store_key: str,
    flyer_url: str
):
    supabase = create_client(supabase_url, supabase_key)
    response = (
        supabase.table("spotter_runs")
        .select("id, store_key, flyer_url, created_at, first_screenshot_hash")
        .eq("store_key", store_key)
        .eq("flyer_url", flyer_url)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if response.data:
        return response.data[0]
    return None


def should_skip_run(
    supabase_url: str,
    supabase_key: str,
    store_key: str,
    flyer_url: str,
    max_age_days: int = 7
) -> bool:
    latest = get_latest_run(supabase_url, supabase_key, store_key, flyer_url)
    if not isinstance(latest, dict):
        return False
    created_at_value = latest.get("created_at")
    if not isinstance(created_at_value, str):
        return False
    created_at = datetime.fromisoformat(created_at_value.replace("Z", "+00:00"))
    return datetime.utcnow() - created_at.replace(tzinfo=None) < timedelta(days=max_age_days)


def record_run(
    supabase_url: str,
    supabase_key: str,
    store_key: str,
    flyer_url: str,
    page_count: int,
    screenshot_paths: List[str],
    product_count: int
) -> None:
    supabase = create_client(supabase_url, supabase_key)
    first_hash = _hash_file(screenshot_paths[0]) if screenshot_paths else None
    supabase.table("spotter_runs").insert({
        "store_key": store_key,
        "flyer_url": flyer_url,
        "page_count": page_count,
        "screenshot_count": len(screenshot_paths),
        "product_count": product_count,
        "first_screenshot_hash": first_hash,
        "run_status": "completed"
    }).execute()
