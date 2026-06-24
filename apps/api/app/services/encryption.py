import base64
from cryptography.fernet import Fernet
from app.core.config import settings

_DEV_KEY = b"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="


def _get_fernet() -> Fernet:
    enc_key = settings.ENCRYPTION_KEY.strip()
    if not enc_key or enc_key == "0" * 64:
        return Fernet(_DEV_KEY)
    return Fernet(base64.urlsafe_b64encode(bytes.fromhex(enc_key[:64])))


def encrypt(plaintext: str) -> str:
    return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    return _get_fernet().decrypt(ciphertext.encode()).decode()
