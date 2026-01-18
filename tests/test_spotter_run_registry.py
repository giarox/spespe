from datetime import datetime, timedelta
from unittest.mock import Mock, patch

import pytest

from src.spotter.core import run_registry


def make_supabase_response(data):
    response = Mock()
    response.data = data
    return response


@patch("src.spotter.core.run_registry.create_client")
def test_should_skip_run_when_recent(create_client_mock):
    now = datetime.utcnow()
    recent_time = (now - timedelta(days=1)).isoformat() + "Z"
    client = Mock()
    client.table.return_value.select.return_value.eq.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = make_supabase_response([
        {"created_at": recent_time}
    ])
    create_client_mock.return_value = client

    assert run_registry.should_skip_run("url", "key", "lidl", "flyer") is True


@patch("src.spotter.core.run_registry.create_client")
def test_should_not_skip_run_when_old(create_client_mock):
    old_time = (datetime.utcnow() - timedelta(days=10)).isoformat() + "Z"
    client = Mock()
    client.table.return_value.select.return_value.eq.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = make_supabase_response([
        {"created_at": old_time}
    ])
    create_client_mock.return_value = client

    assert run_registry.should_skip_run("url", "key", "lidl", "flyer") is False


@patch("src.spotter.core.run_registry.create_client")
def test_should_not_skip_when_missing(create_client_mock):
    client = Mock()
    client.table.return_value.select.return_value.eq.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = make_supabase_response([])
    create_client_mock.return_value = client

    assert run_registry.should_skip_run("url", "key", "lidl", "flyer") is False


@patch("src.spotter.core.run_registry.create_client")
def test_record_run_inserts_payload(create_client_mock, tmp_path):
    client = Mock()
    client.table.return_value.insert.return_value.execute.return_value = make_supabase_response([])
    create_client_mock.return_value = client

    screenshot = tmp_path / "shot.png"
    screenshot.write_bytes(b"test")

    run_registry.record_run("url", "key", "lidl", "flyer", 2, [str(screenshot)], 12)

    insert_call = client.table.return_value.insert
    insert_call.assert_called_once()
    payload = insert_call.call_args[0][0]
    assert payload["store_key"] == "lidl"
    assert payload["flyer_url"] == "flyer"
    assert payload["page_count"] == 2
    assert payload["product_count"] == 12
    assert payload["first_screenshot_hash"]
