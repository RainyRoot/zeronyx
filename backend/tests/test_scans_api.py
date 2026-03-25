"""Integration tests for the Scans REST API — Task 1.14."""

import pytest
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_project(client: TestClient) -> str:
    res = client.post("/api/projects", json={"name": "Test Engagement"})
    assert res.status_code == 201
    return res.json()["id"]


def _create_scan(client: TestClient, project_id: str, tool: str = "nmap") -> dict:
    res = client.post("/api/scans", json={
        "project_id": project_id,
        "tool": tool,
        "config": {"flags": "-T4 -F", "target": "127.0.0.1"},
    })
    assert res.status_code == 201
    return res.json()


# ---------------------------------------------------------------------------
# Tests — create
# ---------------------------------------------------------------------------

def test_create_scan_returns_pending(client: TestClient):
    pid = _create_project(client)
    scan = _create_scan(client, pid)
    assert scan["status"] == "pending"
    assert scan["tool"] == "nmap"
    assert scan["project_id"] == pid
    assert "id" in scan


def test_create_scan_unknown_tool_returns_400(client: TestClient):
    pid = _create_project(client)
    res = client.post("/api/scans", json={
        "project_id": pid,
        "tool": "nonexistent_tool_xyz",
        "config": {},
    })
    assert res.status_code == 400


def test_create_scan_with_profile(client: TestClient):
    pid = _create_project(client)
    res = client.post("/api/scans", json={
        "project_id": pid,
        "tool": "nmap",
        "profile": "Quick Scan",
        "config": {"flags": "-T4 -F", "target": "10.0.0.1"},
    })
    assert res.status_code == 201
    assert res.json()["profile"] == "Quick Scan"


# ---------------------------------------------------------------------------
# Tests — list
# ---------------------------------------------------------------------------

def test_list_scans_empty(client: TestClient):
    pid = _create_project(client)
    res = client.get(f"/api/scans?project_id={pid}")
    assert res.status_code == 200
    data = res.json()
    assert data["items"] == []
    assert data["total"] == 0


def test_list_scans_returns_created(client: TestClient):
    pid = _create_project(client)
    _create_scan(client, pid)
    _create_scan(client, pid)
    res = client.get(f"/api/scans?project_id={pid}")
    assert res.status_code == 200
    assert res.json()["total"] == 2


def test_list_scans_project_isolation(client: TestClient):
    pid1 = _create_project(client)
    pid2 = _create_project(client)
    _create_scan(client, pid1)
    _create_scan(client, pid1)
    _create_scan(client, pid2)

    res1 = client.get(f"/api/scans?project_id={pid1}")
    res2 = client.get(f"/api/scans?project_id={pid2}")
    assert res1.json()["total"] == 2
    assert res2.json()["total"] == 1


def test_list_scans_requires_project_id(client: TestClient):
    res = client.get("/api/scans")
    assert res.status_code == 422


# ---------------------------------------------------------------------------
# Tests — get
# ---------------------------------------------------------------------------

def test_get_scan_returns_detail(client: TestClient):
    pid = _create_project(client)
    scan = _create_scan(client, pid)
    res = client.get(f"/api/scans/{scan['id']}")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == scan["id"]
    assert "raw_output" in data


def test_get_scan_not_found(client: TestClient):
    res = client.get("/api/scans/nonexistent-uuid-xxx")
    assert res.status_code == 404


# ---------------------------------------------------------------------------
# Tests — cancel
# ---------------------------------------------------------------------------

def test_cancel_pending_scan(client: TestClient):
    pid = _create_project(client)
    scan = _create_scan(client, pid)
    res = client.post(f"/api/scans/{scan['id']}/cancel")
    assert res.status_code == 200
    assert res.json()["status"] == "cancelled"


def test_cancel_already_cancelled_returns_409(client: TestClient):
    pid = _create_project(client)
    scan = _create_scan(client, pid)
    client.post(f"/api/scans/{scan['id']}/cancel")
    res = client.post(f"/api/scans/{scan['id']}/cancel")
    assert res.status_code == 409


# ---------------------------------------------------------------------------
# Tests — delete
# ---------------------------------------------------------------------------

def test_delete_scan(client: TestClient):
    pid = _create_project(client)
    scan = _create_scan(client, pid)
    res = client.delete(f"/api/scans/{scan['id']}")
    assert res.status_code == 204
    # Should be gone now
    get_res = client.get(f"/api/scans/{scan['id']}")
    assert get_res.status_code == 404


# ---------------------------------------------------------------------------
# Tests — tools endpoints
# ---------------------------------------------------------------------------

def test_list_tools(client: TestClient):
    res = client.get("/api/tools")
    assert res.status_code == 200
    data = res.json()
    assert "tools" in data
    names = [t["name"] for t in data["tools"]]
    assert "nmap" in names


def test_get_nmap_profiles(client: TestClient):
    res = client.get("/api/tools/nmap/profiles")
    assert res.status_code == 200
    data = res.json()
    assert data["tool"] == "nmap"
    assert len(data["profiles"]) >= 5


def test_get_profiles_unknown_tool(client: TestClient):
    res = client.get("/api/tools/unknowntool999/profiles")
    assert res.status_code == 404


# ---------------------------------------------------------------------------
# Tests — settings
# ---------------------------------------------------------------------------

def test_get_settings(client: TestClient):
    res = client.get("/api/settings")
    assert res.status_code == 200
    data = res.json()
    assert "theme" in data
    assert "scan_timeout" in data
    assert "tool_paths" in data


def test_get_tool_health(client: TestClient):
    res = client.get("/api/settings/tools/health")
    assert res.status_code == 200
    data = res.json()
    assert "tools" in data
    assert "installed_count" in data
    assert "total_count" in data
    assert data["total_count"] >= 1
