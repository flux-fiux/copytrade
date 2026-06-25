"""Tests for external service adapters in mock/dev mode."""
import pytest
from unittest.mock import patch


@pytest.mark.asyncio
async def test_metaapi_dev_mode_provision():
    from app.services.metaapi import MetaAPIService
    svc = MetaAPIService()
    # Patch settings to ensure dev mode
    with patch.object(type(svc), "_dev_mode", new_callable=lambda: property(lambda self: True)):
        result = await svc.provision_account(
            broker="TestBroker", login="12345", password="pass", server="TestBroker-Demo"
        )
    assert "id" in result
    assert result["id"].startswith("mock-")


@pytest.mark.asyncio
async def test_metaapi_dev_mode_account_info():
    from app.services.metaapi import MetaAPIService
    svc = MetaAPIService()
    with patch.object(type(svc), "_dev_mode", new_callable=lambda: property(lambda self: True)):
        result = await svc.get_account_information("mock-account-id")
    assert "balance" in result
    assert "equity" in result


@pytest.mark.asyncio
async def test_copyfactory_dev_mode_strategy():
    from app.services.copyfactory import CopyFactoryService
    svc = CopyFactoryService()
    with patch.object(svc, "_is_mock", return_value=True):
        result = await svc.create_strategy("strat-001", "meta-acct-001", "TestStrategy")
    assert result.get("id") == "strat-001"
    assert result.get("mock") is True


@pytest.mark.asyncio
async def test_email_service_mock_no_key(capsys):
    from app.services.email_service import EmailService
    svc = EmailService()
    # Force _get_client to return None (no key)
    with patch.object(svc, "_get_client", return_value=None):
        result = await svc.send_welcome("test@example.com", "TestUser")
    assert result is True
    out = capsys.readouterr().out
    assert "[EmailService MOCK]" in out


@pytest.mark.asyncio
async def test_cryptomus_mock():
    from app.services.cryptomus_service import CryptomusService
    svc = CryptomusService()
    with patch.object(svc, "_is_mock", return_value=True):
        result = await svc.create_payment(29.0, order_id="test-order-001")
    assert result.get("is_mock") is True
    assert "url" in result
    assert "address" in result
