use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    AeadCore, Aes256Gcm, Key, Nonce,
};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use sha2::{Digest, Sha256};

// ── AES-GCM (reversible encryption) ──────────────────────────────────

/// Derive a 32-byte AES key from a device-specific path + pepper
fn derive_key(app_data_path: &str) -> Key<Aes256Gcm> {
    let pepper = "nityaseva-v1-credential-key-pepper";
    let mut hasher = Sha256::new();
    hasher.update(app_data_path.as_bytes());
    hasher.update(pepper.as_bytes());
    let result = hasher.finalize();
    *Key::<Aes256Gcm>::from_slice(&result)
}

/// Encrypt plaintext → base64(nonce + ciphertext)
pub fn encrypt(plaintext: &str, app_data_path: &str) -> Result<String, String> {
    let key = derive_key(app_data_path);
    let cipher = Aes256Gcm::new(&key);
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);

    let ciphertext = cipher
        .encrypt(&nonce, plaintext.as_bytes())
        .map_err(|e| format!("Encryption failed: {}", e))?;

    let mut combined = nonce.to_vec();
    combined.extend_from_slice(&ciphertext);

    Ok(B64.encode(&combined))
}

/// Decrypt base64(nonce + ciphertext) → plaintext
pub fn decrypt(encoded: &str, app_data_path: &str) -> Result<String, String> {
    let key = derive_key(app_data_path);
    let cipher = Aes256Gcm::new(&key);

    let combined = B64
        .decode(encoded)
        .map_err(|e| format!("Base64 decode failed: {}", e))?;

    if combined.len() < 12 {
        return Err("Invalid encrypted data".to_string());
    }

    let (nonce_bytes, ciphertext) = combined.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| "Decryption failed — wrong key or corrupted data".to_string())?;

    String::from_utf8(plaintext).map_err(|e| e.to_string())
}

/// Check if a value is already AES-GCM encrypted (valid base64, length ≥ 12 bytes decoded)
pub fn is_encrypted(value: &str) -> bool {
    B64.decode(value)
        .map(|b| b.len() >= 12)
        .unwrap_or(false)
}

// ── Bcrypt (one-way hashing for passcodes) ────────────────────────────

const BCRYPT_COST: u32 = 10;

/// Hash a passcode using bcrypt
pub fn hash_passcode(passcode: &str) -> Result<String, String> {
    bcrypt::hash(passcode, BCRYPT_COST).map_err(|e| e.to_string())
}

/// Verify a plain passcode against a bcrypt hash
pub fn verify_passcode(passcode: &str, hash: &str) -> bool {
    bcrypt::verify(passcode, hash).unwrap_or(false)
}

/// Check if a string looks like a bcrypt hash (starts with $2b$ or $2a$)
pub fn is_bcrypt_hash(value: &str) -> bool {
    value.starts_with("$2b$") || value.starts_with("$2a$")
}