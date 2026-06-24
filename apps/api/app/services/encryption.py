import base64
from cryptography.fernet import Fernet
from app.core.config import settings


def _get_fernet() -> Fernet:
    enc_key = settings.ENCRYPTION_KEY.strip()
    if not enc_key:
        if settings.APP_ENV == "development":
            # 仅开发环境：生成一次性内存 key，重启后所有密文失效（可接受）
            return Fernet(Fernet.generate_key())
        raise RuntimeError(
            "ENCRYPTION_KEY must be set in production. "
            "Generate with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
    try:
        raw = bytes.fromhex(enc_key[:64])
        return Fernet(base64.urlsafe_b64encode(raw))
    except ValueError:
        # 也支持直接传 base64 编码的 Fernet key
        return Fernet(enc_key.encode())


def encrypt(plaintext: str) -> str:
    return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    return _get_fernet().decrypt(ciphertext.encode()).decode()
